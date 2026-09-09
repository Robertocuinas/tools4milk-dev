from datetime import timedelta
from collections import deque
from collections.abc import Callable
from threading import Lock
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.refresh_token import RefreshToken
from app.models.usuario import Usuario
from app.time_utils import utc_now


# Nombre y TTL de la cookie HttpOnly que contiene el JWT. Coincide con la
# clave que el frontend lee en `proxy.ts` para redirigir a /login cuando
# expira. El navegador es el único que puede leerla (HttpOnly) y el
# flag Secure se activa en producción (configurable por env).
#
# Contrato canónico Release 3: 8 h (480 min), idéntico al default de
# `settings.access_token_expire_minutes`. `set_auth_cookie` deriva el
# Max-Age del setting en tiempo de ejecución para que token y cookie no
# puedan divergir; esta constante queda como referencia/documentación y
# como valor de respaldo para tests.
AUTH_COOKIE_NAME = "t4m_token"
AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 h, alineado con el frontend

# Cookie HttpOnly paralela para el refresh token (R12). La cookie del
# access tiene el mismo nombre que el legacy ``t4m_token`` para no
# romper integraciones; el refresh usa un nombre distinto para que el
# frontend pueda forzar su borrado en logout sin afectar al access
# vigente. El TTL real lo marca la tabla ``refresh_tokens``.
REFRESH_COOKIE_NAME = "t4m_refresh"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False deja que get_current_user devuelva 401 cuando falta
# Authorization (en lugar del 403 por defecto de HTTPBearer).
bearer_scheme = HTTPBearer(auto_error=False)


class LoginRateLimiter:
    """Rate limiter en memoria para ``POST /auth/login``.

    Implementa un sliding-window por IP: se recuerda la marca temporal de
    cada intento y, antes de permitir uno nuevo, se descartan los
    timestamps fuera de la ventana. Si quedan ``max_attempts`` o más
    dentro de la ventana, se rechaza con 429.

    Suficiente para una sola instancia del backend. Si se escala
    horizontalmente se sustituye por Redis con la misma interfaz
    (``check_and_record(ip)``) y un TTL igual a la ventana.

    Thread-safe: la lista de timestamps y el lock están aislados en un
    solo objeto para que la verificación + inserción sea atómica.
    """

    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self._max_attempts = max_attempts
        self._window_seconds = window_seconds
        # deque[(ip, monotonic_ts)] — la marca se hace con ``time.monotonic``
        # porque es inmune a saltos del reloj del sistema (NTP, DST, etc.).
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()

    def _client_ip(self, request: Request) -> str:
        # En producción tras un reverse proxy, configurar ``real_ip_header``
        # en el proxy y leer ``X-Forwarded-For`` aquí. Para el MVP basta con
        # la IP directa del socket.
        return request.client.host if request.client else "unknown"

    def check_and_record(self, request: Request) -> None:
        """Verifica la ventana y, si pasa, registra un nuevo intento.

        Lanza ``HTTPException(429)`` si la IP ya agotó la cuota.
        """
        import time

        ip = self._client_ip(request)
        now = time.monotonic()
        cutoff = now - self._window_seconds

        with self._lock:
            bucket = self._hits.get(ip)
            if bucket is None:
                bucket = deque()
                self._hits[ip] = bucket
            # Descartar timestamps fuera de la ventana (sliding).
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= self._max_attempts:
                retry_after = max(1, int(self._window_seconds - (now - bucket[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Demasiados intentos de login. "
                        f"Reintenta en {retry_after}s."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )

            bucket.append(now)

    # Útil para los tests: resetea el estado entre casos.
    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


login_rate_limiter = LoginRateLimiter(
    max_attempts=settings.login_rate_limit_max,
    window_seconds=settings.login_rate_limit_window_seconds,
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expires = utc_now() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    return jwt.encode(
        {"sub": subject, "exp": expires, "iat": utc_now(), "jti": str(uuid4())},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def create_refresh_token(
    db: Session,
    user: Usuario,
    emitido_desde_ip: str | None = None,
) -> str:
    """Emite un refresh token firmado Y lo persiste en la tabla.

    El JWT lleva un ``jti`` único que también es la clave de búsqueda
    en ``refresh_tokens``. El TTL es ``settings.refresh_token_expire_days``.
    Si el usuario ya tiene ``settings.refresh_token_max_per_user`` tokens
    activos, se revoca el más antiguo antes de emitir el nuevo (límite
    duro para evitar crecimiento ilimitado).
    """
    from sqlalchemy import func

    expires_at = utc_now() + timedelta(days=settings.refresh_token_expire_days)
    jti = str(uuid4())
    token = jwt.encode(
        {
            "sub": user.username,
            "type": "refresh",
            "exp": expires_at,
            "iat": utc_now(),
            "jti": jti,
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )

    # Cuenta los tokens activos del usuario (no revocados y no expirados).
    # SQLite no preserva tz en columnas DateTime(timezone=True), así que
    # comparamos en UTC naive para ser portable.
    from datetime import timezone as _tz

    now = utc_now()
    now_naive = now.replace(tzinfo=None)
    active_count = db.execute(
        select(func.count(RefreshToken.id)).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now_naive,
        )
    ).scalar_one()

    if active_count >= settings.refresh_token_max_per_user:
        # Revoca el más antiguo (created_at ASC) hasta que quede hueco.
        oldest = db.execute(
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
            )
            .order_by(RefreshToken.created_at.asc())
            .limit(active_count - settings.refresh_token_max_per_user + 1)
        ).scalars().all()
        for rt in oldest:
            rt.revoked_at = now

    db.add(
        RefreshToken(
            id=uuid4(),
            user_id=user.id,
            jti=jti,
            expires_at=expires_at,
            emitido_desde_ip=emitido_desde_ip,
            created_at=now,
        )
    )
    db.commit()
    return token


def decode_refresh_token(token: str) -> dict:
    """Decodifica y valida un refresh token. Lanza ``JWTError`` si es
    inválido, expirado, o su claim ``type`` no es ``"refresh"``."""
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.algorithm],
    )
    if payload.get("type") != "refresh":
        raise JWTError("Token is not a refresh token")
    return payload


def revoke_all_user_refresh_tokens(db: Session, user_id: UUID) -> int:
    """Marca como revocados TODOS los refresh tokens activos de un
    usuario. Se usa en reuse-detection: si alguien presenta un refresh
    que ya estaba revocado, asumimos compromiso de la sesión y
    invalidamos todo.

    Devuelve el número de tokens revocados.
    """
    now = utc_now()
    result = db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    ).scalars().all()
    for rt in result:
        rt.revoked_at = now
    db.commit()
    return len(result)


def set_auth_cookie(response, token: str) -> None:
    """Adjunta el JWT a la respuesta como cookie HttpOnly.

    ``Secure`` se activa automáticamente cuando ``environment`` es
    ``production`` (HTTPS obligatorio). En dev/staging se omite para que
    el cookie funcione sobre http://localhost.
    """
    is_prod = settings.environment.lower() == "production"
    # Max-Age derivado del setting vigente: token y cookie comparten el
    # mismo TTL canónico (8 h por defecto) y no pueden divergir.
    max_age = settings.access_token_expire_minutes * 60
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=max_age,
        path="/",
        httponly=True,
        secure=is_prod,
        samesite="lax",
    )


def unset_auth_cookie(response) -> None:
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")


def set_refresh_cookie(response, token: str) -> None:
    """Adjunta el refresh token como cookie HttpOnly. El Max-Age es el
    TTL del refresh (``refresh_token_expire_days``) en segundos.

    ``SameSite=Strict`` (en lugar de ``Lax`` que usa el access) porque
    el refresh nunca se manda en navegación cross-site — solo en
    llamadas explícitas de la SPA al backend. Esto blinda el flujo
    contra un eventual CSRF sobre el endpoint de rotación.
    """
    is_prod = settings.environment.lower() == "production"
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=is_prod,
        samesite="strict",
    )


def unset_refresh_cookie(response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")


def _extract_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    """Lee el token de la cookie (preferido) o del header Authorization."""
    if credentials is not None and credentials.credentials:
        return credentials.credentials
    cookie_token = request.cookies.get(AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    return None


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> Usuario:
    token = _extract_token(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales no proporcionadas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        username = payload.get("sub")
        if not username:
            raise ValueError("missing subject")
    except (JWTError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = db.execute(select(Usuario).where(Usuario.username == username)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    if not user.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inactivo")
    # La dependencia comparte esta sesión con el endpoint. Finalizar la
    # transacción de lectura devuelve la conexión al pool mientras la petición
    # espera su single-flight de operación; el endpoint la reacquirirá al
    # ejecutar su primera consulta. Sin esto, una ráfaga same-key puede llenar
    # el pool durante la autenticación antes de alcanzar el lock de operación.
    db.expire_on_commit = False
    db.commit()
    db.expunge(user)
    return user


def require_roles(*allowed_roles: str) -> Callable[[Usuario], Usuario]:
    def dependency(current_user: Annotated[Usuario, Depends(get_current_user)]) -> Usuario:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta accion",
            )
        return current_user

    return dependency
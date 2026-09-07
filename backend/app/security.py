from datetime import timedelta
from collections import deque
from collections.abc import Callable
from threading import Lock
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.usuario import Usuario
from app.time_utils import utc_now


# Nombre y TTL de la cookie HttpOnly que contiene el JWT. Coincide con la
# clave que el frontend lee en `proxy.ts` para redirigir a /login cuando
# expira. El navegador es el único que puede leerla (HttpOnly) y el
# flag Secure se activa en producción (configurable por env).
AUTH_COOKIE_NAME = "t4m_token"
AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 h, alineado con el frontend

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


def set_auth_cookie(response, token: str) -> None:
    """Adjunta el JWT a la respuesta como cookie HttpOnly.

    ``Secure`` se activa automáticamente cuando ``environment`` es
    ``production`` (HTTPS obligatorio). En dev/staging se omite para que
    el cookie funcione sobre http://localhost.
    """
    is_prod = settings.environment.lower() == "production"
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=AUTH_COOKIE_MAX_AGE_SECONDS,
        path="/",
        httponly=True,
        secure=is_prod,
        samesite="lax",
    )


def unset_auth_cookie(response) -> None:
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")


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
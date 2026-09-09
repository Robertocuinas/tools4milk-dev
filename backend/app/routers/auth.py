"""Authentication endpoints.

El usuario recibe TRES credenciales distintas (R12):

  1. **access token** — JWT de vida corta (``access_token_expire_minutes``,
     por defecto 60 min) que viaja en la cookie ``t4m_token`` (HttpOnly,
     Secure en prod, SameSite=Lax). Es lo que ``get_current_user``
     valida en cada endpoint protegido.
  2. **refresh token** — JWT de vida larga (``refresh_token_expire_days``,
     por defecto 30 d) persistido en la tabla ``refresh_tokens`` con su
     ``jti``. Se rota en cada ``/auth/refresh``: el viejo se marca
     ``revoked_at`` y se emite uno nuevo.
  3. **reuse detection** — si alguien presenta un refresh ya revocado,
    se asume compromiso y se invalidan TODOS los refresh del usuario
    (defiende contra robo del token).

``POST /auth/logout`` revoca el refresh actual (si lo recibe) y borra
la cookie. ``GET /auth/me`` sigue funcionando como endpoint de "sesión
activa" para que el frontend pueda hidratar al usuario al recargar.

Por compatibilidad con clientes existentes, ``POST /auth/refresh``
también acepta el access token actual y emite un par nuevo. La
rotación estricta (con reuse detection) requiere el refresh token —
preferentemente en el body JSON.
"""
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import RefreshToken, Usuario
from app.schemas.api import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_current_user,
    login_rate_limiter,
    revoke_all_user_refresh_tokens,
    set_auth_cookie,
    set_refresh_cookie,
    unset_auth_cookie,
    unset_refresh_cookie,
    verify_password,
)


router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _build_access_token(username: str) -> tuple[str, int]:
    """Crea el access JWT y devuelve ``(token, expires_in_seconds)``."""
    expires = settings.access_token_expire_minutes * 60
    token = create_access_token(
        username,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return token, expires


def user_payload(user: Usuario) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        activo=user.activo,
        role=user.role,
    )


def _build_full_token_response(
    db: Session, user: Usuario, ip: str | None
) -> TokenResponse:
    """Emite el par ``(access, refresh)`` y devuelve la respuesta API.

    Helper usado por ``/login`` y ``/refresh``. Las cookies HttpOnly se
    adjuntan en la Response del endpoint, no aquí.
    """
    access, access_exp = _build_access_token(user.username)
    refresh = create_refresh_token(db, user, emitido_desde_ip=ip)
    return TokenResponse(
        access_token=access,
        expires_in=access_exp,
        refresh_token=refresh,
        refresh_expires_in=settings.refresh_token_expire_days * 24 * 60 * 60,
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> AuthResponse:
    # Rate limit ANTES de validar credenciales para que un atacante no
    # pueda enumerar usuarios. La cuenta es por IP y sliding-window.
    login_rate_limiter.check_and_record(request)

    user = db.execute(
        select(Usuario).where(Usuario.username == payload.username)
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nombre de usuario o contraseña incorrectos",
        )
    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inactivo"
        )

    # Construir el DTO antes de emitir el refresh. ``create_refresh_token``
    # confirma la transacción y SQLAlchemy puede expirar la instancia; si
    # otro proceso elimina el usuario entre el commit y la serialización,
    # acceder después a ``user`` puede producir ObjectDeletedError.
    response_user = user_payload(user)
    token_response = _build_full_token_response(db, user, _client_ip(request))
    set_auth_cookie(response, token_response.access_token)
    set_refresh_cookie(response, token_response.refresh_token or "")
    return AuthResponse(user=response_user, token=token_response)


@router.get("/me", response_model=UserResponse)
def me(current_user: Annotated[Usuario, Depends(get_current_user)]) -> UserResponse:
    return user_payload(current_user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    db: Annotated[Session, Depends(get_db)] = ...,  # type: ignore[assignment]
) -> TokenResponse:
    """Rota el refresh token.

    Acepta el refresh en este orden de prioridad:
      1. ``payload.refresh_token`` (body JSON) — preferido para tests.
      2. Cookie ``t4m_refresh`` (HttpOnly) — el frontend la usa.

    Validaciones:
      - JWT firmado, no expirado, ``type == "refresh"``.
      - El ``jti`` existe en ``refresh_tokens`` y NO está revocado.
      - Si está revocado → reuse detection: se invalidan TODOS los
        refresh del usuario (compromiso) y se devuelve 401.
    """
    incoming = (payload.refresh_token if payload else None) or request.cookies.get(
        "t4m_refresh"
    )
    if not incoming:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token no proporcionado",
        )

    try:
        claims = decode_refresh_token(incoming)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Refresh token inválido: {exc}",
        ) from exc

    jti = claims.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token sin jti",
        )

    stored = db.execute(
        select(RefreshToken).where(RefreshToken.jti == jti)
    ).scalar_one_or_none()
    if stored is None:
        # El token está bien firmado pero no lo hemos emitido nosotros.
        # Posible token de un deploy anterior o fabricación. Por
        # seguridad, no creamos un par nuevo.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token desconocido",
        )

    # Reuse detection: el token ya fue consumido o revocado.
    if stored.is_revoked:
        user = db.execute(
            select(Usuario).where(Usuario.id == stored.user_id)
        ).scalar_one_or_none()
        if user is not None:
            revoked = revoke_all_user_refresh_tokens(db, user.id)
            # Aquí, en producción, habría que loguear un evento de
            # seguridad (alerta crítica). El MVP se limita a revocar.
            _ = revoked  # placeholder de futuro log de seguridad
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token ya utilizado; todas las sesiones han sido revocadas",
        )

    if stored.is_expired:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expirado",
        )

    user = db.execute(
        select(Usuario).where(Usuario.id == stored.user_id)
    ).scalar_one_or_none()
    if user is None or not user.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no disponible",
        )

    # Rotación: marca el actual como consumido, emite un par nuevo.
    from app.time_utils import utc_now

    stored.revoked_at = utc_now()
    db.commit()

    token_response = _build_full_token_response(db, user, _client_ip(request))
    set_auth_cookie(response, token_response.access_token)
    set_refresh_cookie(response, token_response.refresh_token or "")
    return token_response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    db: Annotated[Session, Depends(get_db)] = ...,  # type: ignore[assignment]
) -> Response:
    """Borra las cookies y revoca el refresh token.

    Si el body o la cookie trae un refresh, lo marca como revocado.
    Si no, es no-op (204). Esto permite que el frontend llame a
    ``/logout`` incluso si la sesión ya expiró.
    """
    incoming = (payload.refresh_token if payload else None) or request.cookies.get(
        "t4m_refresh"
    )
    if incoming:
        try:
            claims = decode_refresh_token(incoming)
            jti = claims.get("jti")
            if jti:
                stored = db.execute(
                    select(RefreshToken).where(RefreshToken.jti == jti)
                ).scalar_one_or_none()
                if stored and not stored.is_revoked:
                    from app.time_utils import utc_now

                    stored.revoked_at = utc_now()
                    db.commit()
        except JWTError:
            # Token inválido: no importa, el objetivo UX es sacar al
            # usuario. Ignoramos.
            pass

    unset_auth_cookie(response)
    unset_refresh_cookie(response)
    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
        headers=response.headers,
    )


__all__ = ["router"]

"""Authentication endpoints.

El token JWT se emite en dos canales:

  1. En el cuerpo de la respuesta (compatibilidad con clientes que
     prefieran ``Authorization: Bearer`` — tests, integraciones).
  2. En una cookie ``Set-Cookie: t4m_token=...; HttpOnly; Secure;
     SameSite=Lax; Path=/; Max-Age=28800``. Esta es la vía preferida
     para el frontend: el navegador la adjunta automáticamente en cada
     ``fetch(..., {credentials: 'include'})`` y ningún XSS puede leerla.

``get_current_user`` (en security.py) prioriza la cookie y cae al header
si no está presente, lo que mantiene compatibilidad con clientes que
sigan mandando ``Authorization``.

``POST /auth/logout`` borra la cookie explícitamente. ``GET /auth/me``
sigue funcionando como endpoint de "sesión activa" para que el
frontend pueda hidratar el usuario al recargar.
"""
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Usuario
from app.schemas.api import AuthResponse, LoginRequest, TokenResponse, UserResponse
from app.security import (
    create_access_token,
    get_current_user,
    login_rate_limiter,
    set_auth_cookie,
    unset_auth_cookie,
    verify_password,
)


router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def _build_token(username: str) -> tuple[str, int]:
    """Crea el JWT y devuelve ``(token, expires_in_seconds)``."""
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

    user = db.execute(select(Usuario).where(Usuario.username == payload.username)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nombre de usuario o contraseña incorrectos",
        )
    if not user.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inactivo")

    token, expires = _build_token(user.username)
    # Cookie HttpOnly: el frontend la recibe en Set-Cookie y el navegador
    # la adjunta en cada petición. Ningún script puede leerla.
    set_auth_cookie(response, token)
    return AuthResponse(
        user=user_payload(user),
        token=TokenResponse(access_token=token, expires_in=expires),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: Annotated[Usuario, Depends(get_current_user)]) -> UserResponse:
    return user_payload(current_user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    current_user: Annotated[Usuario, Depends(get_current_user)],
) -> TokenResponse:
    token, expires = _build_token(current_user.username)
    set_auth_cookie(response, token)
    return TokenResponse(access_token=token, expires_in=expires)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    """Borra la cookie HttpOnly. Idempotente — devuelve 204 incluso si no había cookie."""
    unset_auth_cookie(response)
    # 204 No Content no admite body, pero SÍ permite Set-Cookie
    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
        headers=response.headers,
    )


__all__ = ["router"]
from datetime import timedelta
from collections.abc import Callable
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
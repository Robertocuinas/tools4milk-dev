from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Usuario
from app.schemas.api import AuthResponse, LoginRequest, TokenResponse, UserResponse
from app.security import create_access_token, get_current_user, verify_password


router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def user_payload(user: Usuario) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        activo=user.activo,
        role=user.role,
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> AuthResponse:
    user = db.execute(select(Usuario).where(Usuario.username == payload.username)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nombre de usuario o contraseña incorrectos",
        )
    if not user.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inactivo")

    expires = settings.access_token_expire_minutes * 60
    token = create_access_token(
        user.username,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return AuthResponse(
        user=user_payload(user),
        token=TokenResponse(access_token=token, expires_in=expires),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: Annotated[Usuario, Depends(get_current_user)]) -> UserResponse:
    return user_payload(current_user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(current_user: Annotated[Usuario, Depends(get_current_user)]) -> TokenResponse:
    expires = settings.access_token_expire_minutes * 60
    token = create_access_token(
        current_user.username,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return TokenResponse(access_token=token, expires_in=expires)

from typing import Any, Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, examples=["testuser"])
    password: str = Field(..., min_length=8, examples=["testpass123"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    activo: bool
    role: str = "operario"


class AuthResponse(BaseModel):
    user: UserResponse
    token: TokenResponse


class AlertCreate(BaseModel):
    animal_id: str
    tipo_alerta: str
    severidad: Literal["baja", "media", "alta", "critica"]
    descripcion: str
    recomendacion: str | None = None
    confianza_prediccion: float | None = None


class AlertUpdate(BaseModel):
    estado: Literal["pendiente", "revisada", "resuelta", "falsa_alarma"] | None = None
    notas_operario: str | None = None


class AlertsResponse(BaseModel):
    animal_id: str | None = None
    total: int
    alertas: list[dict[str, Any]]
    estadisticas: dict[str, Any] | None = None
    skip: int = 0
    limit: int = 50

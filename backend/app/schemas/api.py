from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, examples=["testuser"])
    password: str = Field(..., min_length=8, examples=["testpass123"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    # R12 — refresh token rotativo. ``None`` en respuestas que no emiten
    # refresh (p.ej. ``/auth/refresh`` devuelve un par nuevo; el resto
    # de endpoints que solo validan access no lo incluyen).
    refresh_token: str | None = None
    refresh_expires_in: int | None = None


class RefreshRequest(BaseModel):
    """Payload de ``POST /auth/refresh``. Acepta el refresh token en el
    body o en la cookie ``t4m_refresh``. Si se mandan los dos, el body
    gana (orden de prioridad explícito para tests)."""
    refresh_token: str | None = None


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
    estado: Literal["resuelta"]
    notas_operario: str | None = None
    expected_version: int = Field(..., gt=0)


class AlertMutationResponse(BaseModel):
    operation_id: str
    replayed: bool
    alert: dict[str, Any]


class AlertsResponse(BaseModel):
    animal_id: str | None = None
    total: int
    alertas: list[dict[str, Any]]
    estadisticas: dict[str, Any] | None = None
    skip: int = 0
    limit: int = 50


class ProvenanceResponse(BaseModel):
    source: Literal["generated", "aemet_real"]
    mode: Literal["synthetic", "real"]
    synthetic: bool


class AnimalReadingResponse(BaseModel):
    ts: datetime
    fecha: date
    produccion_kg: float | None = None
    scc: int | None = None
    conductividad: float | None = None
    flujo_max: float | None = None
    duracion_min: float | None = None


class AnimalReadingsResponse(BaseModel):
    animal_id: str
    provenance: ProvenanceResponse
    count: int = Field(ge=0)
    days: int = Field(ge=1, le=90)
    limit: int = Field(ge=1, le=180)
    readings: list[AnimalReadingResponse]


class WeatherCorrelationAssociation(BaseModel):
    """Asociación descriptiva entre una variable meteo y una productiva."""

    variable_meteo: str
    variable_productiva: str
    n: int = Field(ge=0)
    pearson_r: float | None = None
    media_meteo: float | None = None
    media_productiva: float | None = None
    interpretacion: str


class WeatherCorrelationResponse(BaseModel):
    """Contrato tipado de GET /weather/correlation/impact (Release 4 DSS)."""

    ubicacion: str
    dias_adelante: int = Field(ge=1, le=30)
    ventana_dias: int = Field(ge=1, le=90)
    metodo: str
    formula: str
    status: Literal["sufficient", "insufficient_data"]
    sample_size: int = Field(ge=0)
    min_sample_size: int = Field(ge=1)
    asociaciones: list[WeatherCorrelationAssociation]
    # Clave legacy del stub: se conserva vacía para compatibilidad.
    impactos_predichos: list[dict[str, Any]] = Field(default_factory=list)
    aviso: str
    provenance: ProvenanceResponse

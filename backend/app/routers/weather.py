from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.contracts import provenance
from app.models.tools4milk import LecturaMeteo
from app.routers.deps import AdminOnly, WeatherReader
from app.security import get_current_user
from app.services.aemet_client import aemet_client

router = APIRouter(
    prefix="/api/v1/weather",
    tags=["Weather"],
    dependencies=[Depends(get_current_user)],
)

_NO_DATA: dict[str, Any] = {
    "temperatura_actual": None,
    "temperatura": None,
    "humedad": None,
    "precipitacion_mm": None,
    "prob_precipitacion_pct": None,
    "descripcion": "No hay datos meteorológicos cargados",
    "impacto_productivo": None,
    "fecha": None,
    "ubicacion": "Villalba, Lugo",
    **provenance("generated"),
}


def _row_provenance(row: LecturaMeteo) -> dict[str, Any]:
    return provenance(row.fuente or "generated")


@router.get("/current")
def weather_current(db: Annotated[Session, Depends(get_db)], _user: WeatherReader) -> dict[str, Any]:
    row = db.execute(
        select(LecturaMeteo).order_by(desc(LecturaMeteo.ts)).limit(1)
    ).scalar_one_or_none()
    if row is None:
        return _NO_DATA
    return {
        **_row_provenance(row),
        "temperatura": float(row.temperatura_c) if row.temperatura_c is not None else None,
        "temperatura_actual": float(row.temperatura_c) if row.temperatura_c is not None else None,
        "humedad": float(row.humedad_relativa) if row.humedad_relativa is not None else None,
        "precipitacion_mm": float(row.precipitacion_mm) if row.precipitacion_mm is not None else None,
        "prob_precipitacion_pct": float(row.prob_precipitacion_pct) if row.prob_precipitacion_pct is not None else None,
        "descripcion": None,
        "impacto_productivo": "normal",
        "fecha": row.ts.isoformat() if row.ts else None,
        "ubicacion": "Villalba, Lugo",
    }


@router.get("/forecast")
def weather_forecast(db: Annotated[Session, Depends(get_db)], _user: WeatherReader) -> dict[str, Any]:
    """Deprecated compatibility route; it never returns a forecast."""
    response = weather_readings(db, _user, limit=7, order="asc")
    response.update({"deprecated": True, "is_forecast": False, "canonical_endpoint": "/weather/readings"})
    response["dias"] = response.pop("lecturas")
    return response


@router.get("/readings")
def weather_readings(
    db: Annotated[Session, Depends(get_db)],
    _user: WeatherReader,
    limit: Annotated[int, Query(ge=1, le=90)] = 14,
    order: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
) -> dict[str, Any]:
    """Returns recent sensor readings ordered by timestamp.
    More accurate label than /forecast — these are real sensor readings, not predictions.
    order=desc (default) returns most recent first; order=asc returns oldest first.
    """
    ordering = desc(LecturaMeteo.ts) if order == "desc" else LecturaMeteo.ts
    rows = db.execute(
        select(LecturaMeteo).order_by(ordering).limit(limit)
    ).scalars().all()
    return {
        "ubicacion": "Villalba, Lugo",
        **(provenance(rows[0].fuente or "generated") if rows else provenance("generated")),
        "total": len(rows),
        "order": order,
        "lecturas": [
            {
                "fecha": row.ts.isoformat() if row.ts else None,
                "temperatura_c": float(row.temperatura_c) if row.temperatura_c is not None else None,
                "humedad_relativa": float(row.humedad_relativa) if row.humedad_relativa is not None else None,
                "precipitacion_mm": float(row.precipitacion_mm) if row.precipitacion_mm is not None else None,
                "prob_precipitacion_pct": float(row.prob_precipitacion_pct) if row.prob_precipitacion_pct is not None else None,
                "viento_km_h": float(row.viento_km_h) if row.viento_km_h is not None else None,
                "direccion_viento": row.direccion_viento,
                "estacion_id": row.estacion_id,
                "fuente": row.fuente or "generated",
            }
            for row in rows
        ],
    }


@router.get("/historical")
def weather_historical(
    db: Annotated[Session, Depends(get_db)],
    _user: WeatherReader,
    dias_atras: Annotated[int, Query(ge=1, le=365)] = 30,
) -> dict[str, Any]:
    rows = db.execute(
        select(LecturaMeteo).order_by(desc(LecturaMeteo.ts)).limit(dias_atras)
    ).scalars().all()
    return {
        "ubicacion": "Villalba, Lugo",
        **(provenance(rows[0].fuente or "generated") if rows else provenance("generated")),
        "dias_atras": dias_atras,
        "datos": [
            {
                "fecha": row.ts.isoformat() if row.ts else None,
                "temperatura_media": float(row.temperatura_c) if row.temperatura_c is not None else None,
                "humedad": float(row.humedad_relativa) if row.humedad_relativa is not None else None,
                "descripcion": None,
                "fuente": row.fuente or "generated",
            }
            for row in rows
        ],
    }


@router.post("/sync")
async def weather_sync(db: Annotated[Session, Depends(get_db)], _user: AdminOnly) -> dict[str, Any]:
    """Synchronize weather data from AEMET or use fallback synthetic data.
    
    Behavior:
    - If AEMET_API_KEY is set and valid: fetches real forecast from AEMET API.
    - If AEMET_API_KEY is missing or empty: generates and stores synthetic data (fallback mode).
    - If AEMET API call fails: returns error with details.
    
    Data is upserted into lecturas_meteorologia table.
    Returns status, modo ("aemet_real" or "generated"), record counts, and timestamp.
    """
    return await aemet_client.sincronizar_datos(db)


@router.get("/correlation/impact")
def weather_impact(
    _user: WeatherReader,
    dias_adelante: Annotated[int, Query(ge=1, le=30)] = 7,
) -> dict[str, Any]:
    return {
        "ubicacion": "Villalba, Lugo",
        "dias_adelante": dias_adelante,
        "impactos_predichos": [],
    }

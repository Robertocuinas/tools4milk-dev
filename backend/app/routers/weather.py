from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tools4milk import LecturaMeteo
from app.services.aemet_client import aemet_client

router = APIRouter(prefix="/api/v1/weather", tags=["Weather"])

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
}


@router.get("/current")
def weather_current(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    row = db.execute(
        select(LecturaMeteo).order_by(desc(LecturaMeteo.ts)).limit(1)
    ).scalar_one_or_none()
    if row is None:
        return _NO_DATA
    return {
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
def weather_forecast(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    """Returns up to 7 recent sensor readings ordered by timestamp.
    NOTE: This is historical sensor data, not a real weather forecast.
    Use /readings for a clearly-labelled version of the same data."""
    rows = db.execute(
        select(LecturaMeteo).order_by(LecturaMeteo.ts).limit(7)
    ).scalars().all()
    return {
        "ubicacion": "Villalba, Lugo",
        "dias": [
            {
                "fecha": row.ts.isoformat() if row.ts else None,
                "temperatura_media": float(row.temperatura_c) if row.temperatura_c is not None else None,
                "temperatura_maxima": None,
                "temperatura_minima": None,
                "humedad": float(row.humedad_relativa) if row.humedad_relativa is not None else None,
                "precipitacion": float(row.precipitacion_mm) if row.precipitacion_mm is not None else None,
                "prob_precipitacion_pct": float(row.prob_precipitacion_pct) if row.prob_precipitacion_pct is not None else None,
                "viento": float(row.viento_km_h) if row.viento_km_h is not None else None,
                "descripcion": None,
                "fuente": "AEMET",
            }
            for row in rows
        ],
    }


@router.get("/readings")
def weather_readings(
    db: Annotated[Session, Depends(get_db)],
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
            }
            for row in rows
        ],
    }


@router.get("/historical")
def weather_historical(
    db: Annotated[Session, Depends(get_db)],
    dias_atras: Annotated[int, Query(ge=1, le=365)] = 30,
) -> dict[str, Any]:
    rows = db.execute(
        select(LecturaMeteo).order_by(desc(LecturaMeteo.ts)).limit(dias_atras)
    ).scalars().all()
    return {
        "ubicacion": "Villalba, Lugo",
        "dias_atras": dias_atras,
        "datos": [
            {
                "fecha": row.ts.isoformat() if row.ts else None,
                "temperatura_media": float(row.temperatura_c) if row.temperatura_c is not None else None,
                "humedad": float(row.humedad_relativa) if row.humedad_relativa is not None else None,
                "descripcion": None,
                "fuente": "AEMET",
            }
            for row in rows
        ],
    }


@router.post("/sync")
async def weather_sync(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
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
def weather_impact(dias_adelante: Annotated[int, Query(ge=1, le=30)] = 7) -> dict[str, Any]:
    return {
        "ubicacion": "Villalba, Lugo",
        "dias_adelante": dias_adelante,
        "impactos_predichos": [],
    }

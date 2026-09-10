"""Serie temporal de lecturas de robot de ordeño por animal (Release 4 DSS).

Expone las filas reales de ``lecturas_robot_ordeno`` para un animal, en orden
ascendente estable por timestamp. No calcula, no interpola y no fabrica puntos:
si no hay filas en el rango pedido, devuelve una lista vacía y el frontend
muestra el estado «Sin datos suficientes».

Todos los datos servidos son sintéticos (``synthetic/generated``); la respuesta
incluye el marcador de provenance canónico.
"""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.contracts import provenance
from app.models.tools4milk import LecturaRobotOrdeno
from app.repositories import animals_repository
from app.routers.deps import DbSession, QualityReader
from app.schemas.api import AnimalReadingResponse, AnimalReadingsResponse
from app.time_utils import utc_now

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"])

_DEFAULT_DAYS = 30
_DEFAULT_LIMIT = 90
_MAX_DAYS = 90
_MAX_LIMIT = 180


def _serialize(row: LecturaRobotOrdeno) -> AnimalReadingResponse:
    return AnimalReadingResponse(
        ts=row.ts,
        fecha=row.ts.date(),
        produccion_kg=float(row.produccion_kg) if row.produccion_kg is not None else None,
        scc=row.scc,
        conductividad=float(row.conductividad) if row.conductividad is not None else None,
        flujo_max=float(row.flujo_max) if row.flujo_max is not None else None,
        duracion_min=float(row.duracion_min) if row.duracion_min is not None else None,
    )


@router.get(
    "/animals/{animal_id}/readings",
    operation_id="list_animal_readings",
    response_model=AnimalReadingsResponse,
    responses={
        200: {
            "content": {
                "application/json": {
                    "examples": {
                        "sample": {
                            "value": {
                                "animal_id": "animal-001",
                                "provenance": {"source": "generated", "mode": "synthetic", "synthetic": True},
                                "count": 2,
                                "days": 30,
                                "limit": 90,
                                "readings": [
                                    {"fecha": "2026-05-01", "produccion_kg": 28.5, "scc": 120000},
                                    {"fecha": "2026-05-02", "produccion_kg": 29.1, "scc": 118000},
                                ],
                            }
                        }
                    }
                }
            }
        },
        404: {"description": "Animal no encontrado"},
        422: {"description": "Parametros invalidos"},
        500: {"description": "Error interno"},
    },
)
def animal_readings(
    animal_id: str,
    db: DbSession,
    _user: QualityReader,
    days: int = Query(default=_DEFAULT_DAYS, ge=1, le=_MAX_DAYS, description="Ventana de días hacia atrás"),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT, description="Máximo de lecturas devueltas"),
) -> AnimalReadingsResponse:
    """Devuelve las lecturas de robot de ordeño de un animal en orden ascendente.

    Serie descriptiva sobre datos sintéticos; sin interpolación ni extrapolación.
    """
    animal = animals_repository.get_by_id(db, animal_id)
    if animal is None:
        raise HTTPException(status_code=404, detail="Animal no encontrado")
    cutoff = utc_now() - timedelta(days=days)
    rows = list(
        db.scalars(
            select(LecturaRobotOrdeno)
            .where(LecturaRobotOrdeno.animal_id == animal.id, LecturaRobotOrdeno.ts >= cutoff)
            .order_by(LecturaRobotOrdeno.ts.desc(), LecturaRobotOrdeno.robot_id.desc())
            .limit(limit)
        ).all()
    )
    rows.reverse()
    return AnimalReadingsResponse(
        animal_id=str(animal.id),
        provenance=provenance("generated"),
        count=len(rows),
        days=days,
        limit=limit,
        readings=[_serialize(row) for row in rows],
    )

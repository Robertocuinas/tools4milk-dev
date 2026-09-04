from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.models.tools4milk import Alerta
from app.repositories import alerts_repository, animals_repository
from app.routers.deps import ClinicalManager, DbSession
from app.schemas.api import AlertCreate, AlertsResponse, AlertUpdate
from app.security import get_current_user
from app.services import alerts_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


def _alerts_response(
    items: list[Alerta],
    skip: int,
    limit: int,
    animal_id: str | None = None,
) -> AlertsResponse:
    page = items[skip : skip + limit]
    pending = [a for a in items if a.activa and not a.ts_resolucion]
    return AlertsResponse(
        animal_id=animal_id,
        total=len(items),
        alertas=[alerts_service.serialize(a) for a in page],
        skip=skip,
        limit=limit,
        estadisticas={
            "total_alertas": len(items),
            "alertas_ultimos_30_dias": len(items),
            "pendientes": len(pending),
            "tasa_resolucion_pct": 0,
            "severidad_promedio": "media",
        },
    )


@router.get("/alerts/critical")
def critical_alerts(db: DbSession) -> AlertsResponse:
    items = alerts_repository.get_critical(db)
    return _alerts_response(items, 0, 50)


@router.get("/alerts")
def list_alerts(db: DbSession, skip: int = 0, limit: int = 50, severidad: str | None = None) -> AlertsResponse:
    items = alerts_repository.get_all(db, skip=0, limit=10000, nivel=severidad)
    return _alerts_response(items, skip, limit)


@router.post("/alerts", status_code=201)
def create_alert(payload: AlertCreate, db: DbSession, _user: ClinicalManager) -> dict[str, Any]:
    item = alerts_repository.create(db, payload.model_dump())
    return alerts_service.serialize(item)


@router.get("/alerts/detail/{alert_id}")
def alert_detail(alert_id: str, db: DbSession) -> dict[str, Any]:
    item = alerts_repository.get_by_id(db, alert_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return alerts_service.serialize(item)


@router.patch("/alerts/{alert_id}")
def review_alert(alert_id: str, payload: AlertUpdate, db: DbSession, _user: ClinicalManager) -> dict[str, Any]:
    item = alerts_repository.get_by_id(db, alert_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    item = alerts_repository.resolve(db, item, payload.model_dump(exclude_none=True))
    return alerts_service.serialize(item)


@router.get("/alerts/{animal_id}")
def animal_alerts(animal_id: str, db: DbSession, skip: int = 0, limit: int = 50) -> AlertsResponse:
    items = alerts_repository.get_by_animal(db, animal_id, skip=0, limit=10000)
    return _alerts_response(items, skip, limit, animal_id=animal_id)


@router.post("/alerts/generate/{animal_id}")
def generate_alerts(animal_id: str, db: DbSession, _user: ClinicalManager) -> dict[str, Any]:
    animal = animals_repository.get_by_id(db, animal_id)
    if animal is None:
        raise HTTPException(status_code=404, detail="Animal no encontrado")
    return {"generated": 0, "alertas": [], "animal_id": animal_id}

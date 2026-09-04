from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.repositories import lactations_repository
from app.routers.deps import DbSession, QualityManager
from app.security import get_current_user
from app.services import lactations_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


@router.get("/lactations")
def lactations(
    db: DbSession,
    skip: int = 0,
    limit: int = 50,
    animal_id: str | None = None,
    activa: bool | None = None,
) -> list[dict[str, Any]]:
    items = lactations_repository.get_all(db, skip=skip, limit=limit, animal_id=animal_id, activa=activa)
    return [lactations_service.serialize(l) for l in items]


@router.post("/lactations", status_code=201)
def create_lactation(payload: dict[str, Any], db: DbSession, _user: QualityManager) -> dict[str, Any]:
    item = lactations_repository.create(db, payload)
    return lactations_service.serialize(item)


@router.get("/lactations/quality/summary")
def quality_summary(db: DbSession) -> dict[str, Any]:
    items = lactations_repository.get_all_active(db)
    return lactations_service.quality_summary(items)


@router.put("/lactations/{lactation_id}")
def update_lactation(
    lactation_id: str,
    payload: dict[str, Any],
    db: DbSession,
    _user: QualityManager,
) -> dict[str, Any]:
    item = lactations_repository.get_by_id(db, lactation_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Lactacion no encontrada")
    item = lactations_repository.update(db, item, payload)
    return lactations_service.serialize(item)

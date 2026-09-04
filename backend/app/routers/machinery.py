from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.repositories import machinery_repository
from app.routers.deps import DbSession, OperationsManager
from app.security import get_current_user
from app.services import machinery_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


def _estado_to_activa(estado: str | None) -> bool | None:
    if estado is None:
        return None
    return estado in {"operativa", "revision_programada"}


@router.get("/machinery")
def machinery(
    db: DbSession,
    skip: int = 0,
    limit: int = 50,
    estado: str | None = None,
    zona_id: str | None = None,
) -> list[dict[str, Any]]:
    items = machinery_repository.get_all(
        db, skip=skip, limit=limit, activa=_estado_to_activa(estado), zona_id=zona_id
    )
    return [machinery_service.serialize(m) for m in items]


@router.post("/machinery", status_code=201)
def create_machinery(payload: dict[str, Any], db: DbSession, _user: OperationsManager) -> dict[str, Any]:
    item = machinery_repository.create(db, payload)
    return machinery_service.serialize(item)


@router.put("/machinery/{machinery_id}")
def update_machinery(
    machinery_id: str,
    payload: dict[str, Any],
    db: DbSession,
    _user: OperationsManager,
) -> dict[str, Any]:
    item = machinery_repository.get_by_id(db, machinery_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Maquinaria no encontrada")
    item = machinery_repository.update(db, item, payload)
    return machinery_service.serialize(item)

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.repositories import incidents_repository
from app.routers.deps import DbSession, OperationsManager
from app.security import get_current_user
from app.services import incidents_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


@router.get("/incidents")
def incidents(
    db: DbSession,
    skip: int = 0,
    limit: int = 50,
    zona_id: str | None = None,
    animal_id: str | None = None,
    maquinaria_id: str | None = None,
    estado: str | None = None,
    tipo: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
) -> list[dict[str, Any]]:
    from datetime import datetime as _dt
    try:
        fd = _dt.fromisoformat(fecha_desde.replace("Z", "+00:00")) if fecha_desde else None
        fh = _dt.fromisoformat(fecha_hasta.replace("Z", "+00:00")) if fecha_hasta else None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Formato de fecha invalido") from exc
    items = incidents_repository.get_all(
        db, skip=skip, limit=limit,
        zona_id=zona_id, animal_id=animal_id, maquinaria_id=maquinaria_id,
        estado=estado, tipo=tipo, fecha_desde=fd, fecha_hasta=fh,
    )
    return [incidents_service.serialize(i) for i in items]


@router.post("/incidents", status_code=201)
def create_incident(payload: dict[str, Any], db: DbSession, _user: OperationsManager) -> dict[str, Any]:
    item = incidents_repository.create(db, payload)
    return incidents_service.serialize(item)


@router.get("/incidents/{incident_id}")
def incident_detail(incident_id: str, db: DbSession) -> dict[str, Any]:
    item = incidents_repository.get_by_id(db, incident_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return incidents_service.serialize(item)


@router.put("/incidents/{incident_id}")
def update_incident(incident_id: str, payload: dict[str, Any], db: DbSession, _user: OperationsManager) -> dict[str, Any]:
    item = incidents_repository.get_by_id(db, incident_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    item = incidents_repository.update(db, item, payload)
    return incidents_service.serialize(item)

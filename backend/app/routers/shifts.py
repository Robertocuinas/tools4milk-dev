from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.repositories import shifts_repository
from app.security import get_current_user
from app.services import shifts_service

router = APIRouter(prefix="/api/v1", tags=["turnos"])

DbDep = Annotated[Session, Depends(get_db)]
UserDep = Annotated[Usuario, Depends(get_current_user)]


@router.get("/turnos")
def list_turnos(
    db: DbDep,
    current_user: UserDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    fecha: date | None = Query(None),
    tipo_turno: str | None = Query(None),
) -> dict[str, Any]:
    items = shifts_repository.get_all_turnos(db, skip=skip, limit=limit, fecha=fecha, tipo_turno=tipo_turno)
    return {"total": len(items), "turnos": [shifts_service.serialize_turno(t) for t in items]}


@router.post("/turnos")
def create_turno(body: dict, db: DbDep, current_user: UserDep) -> dict[str, Any]:
    from sqlalchemy.exc import IntegrityError
    for required in ("fecha", "tipo_turno", "hora_inicio", "hora_fin"):
        if not body.get(required):
            raise HTTPException(status_code=422, detail=f"El campo '{required}' es obligatorio")
    try:
        item = shifts_repository.create_turno(db, body)
    except IntegrityError:
        db.rollback()
        # Return existing shift if already created for this date+tipo
        existing = shifts_repository.get_all_turnos(
            db, fecha=body["fecha"], tipo_turno=body["tipo_turno"]
        )
        if existing:
            return shifts_service.serialize_turno(existing[0])
        raise HTTPException(status_code=409, detail="Turno duplicado")
    return shifts_service.serialize_turno(item)


@router.get("/asignaciones-turno")
def list_asignaciones(
    db: DbDep,
    current_user: UserDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    turno_id: str | None = Query(None),
    empleado_id: str | None = Query(None),
) -> dict[str, Any]:
    items = shifts_repository.get_all_asignaciones(db, skip=skip, limit=limit, turno_id=turno_id, empleado_id=empleado_id)
    return {"total": len(items), "asignaciones": [shifts_service.serialize_asignacion(a) for a in items]}


@router.post("/asignaciones-turno")
def create_asignacion(body: dict, db: DbDep, current_user: UserDep) -> dict[str, Any]:
    for required in ("turno_id", "empleado_id"):
        if not body.get(required):
            raise HTTPException(status_code=422, detail=f"El campo '{required}' es obligatorio")
    try:
        item = shifts_repository.create_asignacion(db, body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return shifts_service.serialize_asignacion(item)

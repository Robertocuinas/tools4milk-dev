from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.repositories import employees_repository
from app.routers.deps import AdminOnly, DbSession
from app.security import get_current_user
from app.services import employees_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


@router.get("/employees")
def employees(db: DbSession, activo: bool | None = None) -> list[dict[str, Any]]:
    items = employees_repository.get_all(db, activo=activo)
    return [employees_service.serialize(e) for e in items]


@router.post("/employees", status_code=201)
def create_employee(payload: dict[str, Any], db: DbSession, _user: AdminOnly) -> dict[str, Any]:
    item = employees_repository.create(db, payload)
    return employees_service.serialize(item)


@router.put("/employees/{employee_id}")
def update_employee(employee_id: str, payload: dict[str, Any], db: DbSession, _user: AdminOnly) -> dict[str, Any]:
    item = employees_repository.get_by_id(db, employee_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    item = employees_repository.update(db, item, payload)
    return employees_service.serialize(item)

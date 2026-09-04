from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.repositories import animals_repository
from app.routers.deps import AnimalManager, DbSession
from app.security import get_current_user
from app.services import animals_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


@router.get(
    "/animals",
    operation_id="list_animals",
    responses={
        200: {
            "content": {
                "application/json": {
                    "examples": {
                        "sample": {
                            "value": [
                                {
                                    "id": "animal-001",
                                    "crotal_oficial": "ES001",
                                    "nombre": "Luna",
                                    "estado": "produccion",
                                }
                            ]
                        }
                    }
                }
            }
        },
        422: {"description": "Parametros invalidos"},
        500: {"description": "Error interno"},
    },
)
def animals(db: DbSession, skip: int = 0, limit: int = 50, estado: str | None = None) -> list[dict[str, Any]]:
    items = animals_repository.get_all(db, skip=skip, limit=limit, estado=estado)
    return [animals_service.serialize(a) for a in items]


@router.get("/animals/active-count")
def animals_active_count(db: DbSession) -> int:
    return animals_repository.count_active(db)


@router.post("/animals", status_code=201)
def create_animal(payload: dict[str, Any], db: DbSession, _user: AnimalManager) -> dict[str, Any]:
    item = animals_repository.create(db, payload)
    return animals_service.serialize(item)


@router.get("/animals/search/by-crotal/{crotal}")
def animal_by_crotal(crotal: str, db: DbSession) -> dict[str, Any]:
    item = animals_repository.get_by_crotal(db, crotal)
    if item is None:
        raise HTTPException(status_code=404, detail="Animal no encontrado")
    return animals_service.serialize(item)


@router.get("/animals/{animal_id}")
def animal_detail(animal_id: str, db: DbSession) -> dict[str, Any]:
    item = animals_repository.get_by_id(db, animal_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Animal no encontrado")
    return animals_service.serialize(item)


@router.put("/animals/{animal_id}")
def update_animal(animal_id: str, payload: dict[str, Any], db: DbSession, _user: AnimalManager) -> dict[str, Any]:
    item = animals_repository.get_by_id(db, animal_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Animal no encontrado")
    item = animals_repository.update(db, item, payload)
    return animals_service.serialize(item)

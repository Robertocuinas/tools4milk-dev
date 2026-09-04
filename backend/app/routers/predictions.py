from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.routers.deps import DbSession
from app.security import get_current_user
from app.services import predictions_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


@router.get("/predictions/{animal_id}")
def predictions(animal_id: str, db: DbSession) -> dict[str, Any]:
    animal = predictions_service.get_animal_or_none(db, animal_id)
    if animal is None:
        raise HTTPException(status_code=404, detail="Animal no encontrado")
    result = predictions_service.compute_prediction(db, animal)
    # Conserva el identificador tal como lo pidió el cliente (id o crotal).
    result["animal_id"] = animal_id
    return result


@router.get("/predictions/production/{animal_id}")
def production_prediction(animal_id: str, db: DbSession) -> dict[str, Any]:
    return predictions(animal_id, db)["produccion"]


@router.get("/predictions/composition/{animal_id}")
def composition_prediction(animal_id: str, db: DbSession) -> dict[str, Any]:
    return predictions(animal_id, db)["composicion"]


@router.get("/predictions/health-risk/{animal_id}")
def health_risk_prediction(animal_id: str, db: DbSession) -> dict[str, Any]:
    return predictions(animal_id, db)["riesgo_sanitario"]

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from typing import Annotated

from app.models.tools4milk import Alerta
from app.repositories import alerts_repository, animals_repository, tasks_repository
from app.routers.deps import ClinicalManager, DbSession
from app.schemas.api import AlertCreate, AlertMutationResponse, AlertsResponse, AlertUpdate
from app.security import get_current_user
from app.services import alerts_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


def _alerts_response(
    items: list[Alerta],
    total: int,
    skip: int,
    limit: int,
    animal_id: str | None = None,
) -> AlertsResponse:
    pending = [a for a in items if a.activa and not a.ts_resolucion]
    return AlertsResponse(
        animal_id=animal_id,
        total=total,
        alertas=[alerts_service.serialize(a) for a in items],
        skip=skip,
        limit=limit,
        estadisticas={
            "total_alertas": total,
            "alertas_ultimos_30_dias": total,
            "pendientes": len(pending),
            "tasa_resolucion_pct": 0,
            "severidad_promedio": "media",
        },
    )


@router.get("/alerts/critical")
def critical_alerts(
    db: DbSession,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AlertsResponse:
    total = alerts_repository.count_critical(db)
    items = alerts_repository.get_critical(db, skip=skip, limit=limit)
    return _alerts_response(items, total, skip, limit)


@router.get("/alerts")
def list_alerts(
    db: DbSession,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    severidad: str | None = None,
) -> AlertsResponse:
    total = alerts_repository.count_all(db, nivel=severidad)
    items = alerts_repository.get_all(db, skip=skip, limit=limit, nivel=severidad)
    return _alerts_response(items, skip=skip, limit=limit, total=total)


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


@router.patch(
    "/alerts/{alert_id}",
    operation_id="resolve_alert",
    response_model=AlertMutationResponse,
    responses={
        401: {"description": "Autenticación requerida"},
        403: {"description": "Se requiere capability resolve_alert"},
        409: {"description": "Conflicto de versión o de idempotencia"},
        422: {"description": "Payload u operation id inválido"},
        428: {"description": "X-Operation-Id obligatorio"},
    },
    openapi_extra={
        "parameters": [
            {
                "name": "X-Operation-Id",
                "in": "header",
                "required": True,
                "schema": {"type": "string", "format": "uuid"},
            }
        ]
    },
)
def resolve_alert(
    alert_id: str,
    payload: AlertUpdate,
    db: DbSession,
    user: ClinicalManager,
    operation_id: str | None = Header(default=None, alias="X-Operation-Id", include_in_schema=False),
) -> dict[str, Any]:
    if operation_id is None:
        raise HTTPException(
            status_code=428,
            detail={
                "code": "operation_id_required",
                "message": "X-Operation-Id es obligatorio para resolver alertas",
            },
        )
    try:
        parsed_operation_id = uuid.UUID(operation_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_operation_id", "message": "X-Operation-Id debe ser UUID"},
        ) from exc

    item = alerts_repository.get_by_id(db, alert_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")

    try:
        response, replayed = alerts_repository.resolve_idempotent(
            db,
            item,
            payload.model_dump(exclude_none=True),
            user.id,
            parsed_operation_id,
            f"/api/v1/alerts/{alert_id}",
        )
    except tasks_repository.IdempotencyConflict as exc:
        db.rollback()
        status_code = 409 if exc.code in {"stale_version", "operation_payload_mismatch", "invalid_transition"} else 422
        raise HTTPException(status_code=status_code, detail=exc.payload.get("error", exc.payload)) from exc

    response["replayed"] = replayed
    return response


@router.get("/alerts/{animal_id}")
def animal_alerts(
    animal_id: str,
    db: DbSession,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AlertsResponse:
    total = alerts_repository.count_by_animal(db, animal_id)
    items = alerts_repository.get_by_animal(db, animal_id, skip=skip, limit=limit)
    return _alerts_response(items, total, skip, limit, animal_id=animal_id)


@router.post("/alerts/generate/{animal_id}")
def generate_alerts(animal_id: str, db: DbSession, _user: ClinicalManager) -> dict[str, Any]:
    animal = animals_repository.get_by_id(db, animal_id)
    if animal is None:
        raise HTTPException(status_code=404, detail="Animal no encontrado")
    return {"generated": 0, "alertas": [], "animal_id": animal_id}

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.models.tools4milk import BoxRecria
from app.repositories import zones_repository
from app.routers.deps import AdminOnly, DbSession
from app.security import get_current_user
from app.services import zones_service

router = APIRouter(prefix="/api/v1", tags=["Frontend Core"], dependencies=[Depends(get_current_user)])


@router.get("/zones")
def zones(db: DbSession) -> list[dict[str, Any]]:
    return [zones_service.serialize(z) for z in zones_repository.get_all(db)]


@router.post(
    "/zones",
    status_code=201,
    operation_id="create_zone",
    responses={422: {"description": "Payload invalido"}, 500: {"description": "Error interno"}},
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "examples": {
                        "sample": {
                            "value": {
                                "nombre": "Secado",
                                "codigo": "SEC",
                                "tiene_pantalla_tv": True,
                                "tiene_tablet": True,
                            }
                        }
                    }
                }
            }
        }
    },
)
def create_zone(payload: dict[str, Any], db: DbSession, _user: AdminOnly) -> dict[str, Any]:
    zone = zones_repository.create(db, payload)
    return zones_service.serialize(zone)


@router.get("/zones/{zone_id}")
def zone_detail(zone_id: str, db: DbSession) -> dict[str, Any]:
    item = zones_repository.get_by_id(db, zone_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Zona no encontrada")
    return zones_service.serialize(item)


@router.get("/boxes-recria")
def boxes_recria(db: DbSession, activo: bool | None = True) -> list[dict[str, Any]]:
    query = select(BoxRecria).order_by(BoxRecria.box_numero)
    if activo is not None:
        query = query.where(BoxRecria.activo.is_(activo))
    items = db.scalars(query).all()
    return [
        {
            "id": str(item.id),
            "box_numero": item.box_numero,
            "ternero_id": str(item.ternero_id) if item.ternero_id else None,
            "fecha_entrada": item.fecha_entrada.isoformat() if item.fecha_entrada else None,
            "fecha_salida": item.fecha_salida.isoformat() if item.fecha_salida else None,
            "activo": item.activo,
            "alertas_box": item.alertas_box or [],
            "notas": item.notas,
        }
        for item in items
    ]


@router.put("/zones/{zone_id}")
def update_zone(zone_id: str, payload: dict[str, Any], db: DbSession, _user: AdminOnly) -> dict[str, Any]:
    item = zones_repository.get_by_id(db, zone_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Zona no encontrada")
    item = zones_repository.update(db, item, payload)
    return zones_service.serialize(item)

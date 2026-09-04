import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.repositories import orders_repository
from app.security import get_current_user
from app.services import orders_service

router = APIRouter(prefix="/api/v1/pedidos", tags=["pedidos"])

DbDep = Annotated[Session, Depends(get_db)]
UserDep = Annotated[Usuario, Depends(get_current_user)]

_ESTADOS_VALIDOS = {"solicitado", "aprobado", "en_transito", "recibido", "cancelado"}


@router.get("")
def list_pedidos(
    db: DbDep,
    current_user: UserDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    estado: str | None = Query(None),
) -> dict[str, Any]:
    items = orders_repository.get_all(db, skip=skip, limit=limit, estado=estado)
    return {"total": len(items), "pedidos": [orders_service.serialize(p) for p in items]}


@router.get("/{pedido_id}")
def get_pedido(pedido_id: str, db: DbDep, current_user: UserDep) -> dict[str, Any]:
    item = orders_repository.get_by_id(db, pedido_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return orders_service.serialize(item)


@router.post("")
def create_pedido(body: dict, db: DbDep, current_user: UserDep) -> dict[str, Any]:
    if not body.get("insumo"):
        raise HTTPException(status_code=422, detail="El campo 'insumo' es obligatorio")
    if body.get("cantidad") is None:
        raise HTTPException(status_code=422, detail="El campo 'cantidad' es obligatorio")
    item = orders_repository.create(db, body)
    return orders_service.serialize(item)


@router.put("/{pedido_id}")
def update_pedido(pedido_id: str, body: dict, db: DbDep, current_user: UserDep) -> dict[str, Any]:
    item = orders_repository.get_by_id(db, pedido_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    item = orders_repository.update(db, item, body)
    return orders_service.serialize(item)


@router.patch("/{pedido_id}/estado")
def patch_estado(pedido_id: str, body: dict, db: DbDep, current_user: UserDep) -> dict[str, Any]:
    estado = body.get("estado")
    if not estado or estado not in _ESTADOS_VALIDOS:
        raise HTTPException(
            status_code=422,
            detail=f"Estado inválido. Valores permitidos: {sorted(_ESTADOS_VALIDOS)}",
        )
    item = orders_repository.get_by_id(db, pedido_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    item = orders_repository.update_estado(db, item, estado)
    return orders_service.serialize(item)

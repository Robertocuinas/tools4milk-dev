import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tools4milk import Maquinaria


def get_all(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    activa: bool | None = None,
    zona_id: str | None = None,
) -> list[Maquinaria]:
    query = select(Maquinaria).order_by(Maquinaria.nombre)
    if activa is not None:
        query = query.where(Maquinaria.activa.is_(activa))
    if zona_id is not None:
        try:
            query = query.where(Maquinaria.zona_id == uuid.UUID(zona_id))
        except (ValueError, AttributeError):
            pass
    return list(db.scalars(query.offset(skip).limit(limit)).all())


def get_by_id(db: Session, machinery_id: str) -> Maquinaria | None:
    try:
        uid = uuid.UUID(machinery_id)
    except (ValueError, AttributeError):
        return None
    return db.get(Maquinaria, uid)


def create(db: Session, data: dict) -> Maquinaria:
    item = Maquinaria(
        id=uuid.uuid4(),
        nombre=data["nombre"],
        tipo=data.get("tipo", "otro"),
        zona_id=_to_uuid(data.get("zona_id")),
        marca=data.get("marca"),
        modelo=data.get("modelo"),
        numero_serie=data.get("numero_serie"),
        activa=bool(data.get("activa", True)),
        estado=data.get("estado", "operativa"),
        notas=data.get("notas") or data.get("observaciones"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update(db: Session, item: Maquinaria, data: dict) -> Maquinaria:
    allowed = {"nombre", "tipo", "marca", "modelo", "numero_serie", "activa", "estado", "notas"}
    for key, value in data.items():
        if key == "zona_id":
            item.zona_id = _to_uuid(value)
        elif key == "observaciones":
            item.notas = value
        elif key == "estado":
            item.estado = value
            item.activa = value not in {"baja", "inactiva"}
        elif key in allowed:
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def _to_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None

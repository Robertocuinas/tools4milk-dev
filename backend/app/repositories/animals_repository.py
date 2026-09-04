import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tools4milk import Animal


def get_all(db: Session, skip: int = 0, limit: int = 50, estado: str | None = None) -> list[Animal]:
    query = select(Animal).order_by(Animal.crotal_oficial)
    if estado is not None:
        query = query.where(Animal.estado == estado)
    return list(db.scalars(query.offset(skip).limit(limit)).all())


def count_active(db: Session) -> int:
    from sqlalchemy import func
    return db.scalar(select(func.count()).select_from(Animal).where(Animal.estado != "baja")) or 0


def get_by_id(db: Session, animal_id: str) -> Animal | None:
    try:
        uid = uuid.UUID(animal_id)
    except (ValueError, AttributeError):
        return None
    return db.get(Animal, uid)


def get_by_crotal(db: Session, crotal: str) -> Animal | None:
    return db.scalar(select(Animal).where(Animal.crotal_oficial == crotal))


def create(db: Session, data: dict) -> Animal:
    item = Animal(
        id=uuid.uuid4(),
        crotal_oficial=data["crotal_oficial"],
        nombre=data.get("nombre"),
        sexo=data.get("sexo", "hembra"),
        fecha_nacimiento=_parse_date(data.get("fecha_nacimiento")),
        raza=data.get("raza"),
        estado=data.get("estado", "recria"),
        estado_reproductivo=data.get("estado_reproductivo"),
        fecha_entrada=_parse_date(data.get("fecha_entrada")) or date.today(),
        fecha_baja=_parse_date(data.get("fecha_baja")),
        motivo_baja=data.get("motivo_baja"),
        notas=data.get("notas"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update(db: Session, item: Animal, data: dict) -> Animal:
    date_fields = {"fecha_nacimiento", "fecha_entrada", "fecha_baja"}
    allowed = {"nombre", "sexo", "fecha_nacimiento", "raza", "estado", "estado_reproductivo",
               "fecha_entrada", "fecha_baja", "motivo_baja", "notas"}
    for key, value in data.items():
        if key not in allowed:
            continue
        setattr(item, key, _parse_date(value) if key in date_fields else value)
    db.commit()
    db.refresh(item)
    return item


def _parse_date(value: str | date | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None

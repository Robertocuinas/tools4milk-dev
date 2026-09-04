from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tools4milk import Zona


def get_all(db: Session) -> list[Zona]:
    return list(db.scalars(select(Zona).order_by(Zona.codigo)).all())


def get_by_id(db: Session, zone_id: str) -> Zona | None:
    try:
        import uuid
        uid = uuid.UUID(zone_id)
    except (ValueError, AttributeError):
        return None
    return db.get(Zona, uid)


def get_by_codigo(db: Session, codigo: str) -> Zona | None:
    return db.scalar(select(Zona).where(Zona.codigo == codigo))


def create(db: Session, data: dict) -> Zona:
    import uuid
    item = Zona(
        id=uuid.UUID(data["id"]) if data.get("id") else uuid.uuid4(),
        nombre=data["nombre"],
        codigo=data["codigo"],
        descripcion=data.get("descripcion"),
        tiene_pantalla_tv=bool(data.get("tiene_pantalla_tv", False)),
        tiene_tablet=bool(data.get("tiene_tablet", False)),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update(db: Session, item: Zona, data: dict) -> Zona:
    allowed = {"nombre", "codigo", "descripcion", "tiene_pantalla_tv", "tiene_tablet"}
    for key, value in data.items():
        if key in allowed:
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

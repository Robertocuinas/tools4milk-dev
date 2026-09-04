import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import TipoIncidencia
from app.models.tools4milk import Animal, Incidencia


def get_all(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    zona_id: str | None = None,
    animal_id: str | None = None,
    maquinaria_id: str | None = None,
    estado: str | None = None,
    tipo: str | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
) -> list[Incidencia]:
    query = select(Incidencia).order_by(Incidencia.ts_apertura.desc())

    if zona_id is not None:
        try:
            query = query.where(Incidencia.zona_id == uuid.UUID(zona_id))
        except (ValueError, AttributeError):
            return []

    if animal_id is not None:
        resolved_animal_id = _resolve_animal_uuid(db, animal_id)
        if resolved_animal_id is None:
            return []
        query = query.where(Incidencia.animal_id == resolved_animal_id)

    if maquinaria_id is not None:
        try:
            query = query.where(Incidencia.maquinaria_id == uuid.UUID(maquinaria_id))
        except (ValueError, AttributeError):
            return []

    if estado is not None:
        query = query.where(Incidencia.estado == estado)

    if tipo is not None:
        query = query.where(Incidencia.tipo == tipo)

    if fecha_desde is not None:
        query = query.where(Incidencia.ts_apertura >= fecha_desde)

    if fecha_hasta is not None:
        query = query.where(Incidencia.ts_apertura <= fecha_hasta)

    return list(db.scalars(query.offset(skip).limit(limit)).all())


def get_by_id(db: Session, incident_id: str) -> Incidencia | None:
    try:
        uid = uuid.UUID(incident_id)
    except (ValueError, AttributeError):
        return None
    return db.get(Incidencia, uid)


def create(db: Session, data: dict) -> Incidencia:
    item = Incidencia(
        id=uuid.uuid4(),
        tipo=data.get("tipo", TipoIncidencia.INFRAESTRUCTURA.value),
        subtipo=data.get("subtipo"),
        severidad=data.get("prioridad") or data.get("severidad", "media"),
        estado="abierta",
        titulo=data.get("titulo") or data.get("descripcion", "Nueva incidencia")[:200],
        descripcion=data.get("descripcion"),
        zona_id=_to_uuid(data.get("zona_id")),
        maquinaria_id=_to_uuid(data.get("maquinaria_id")),
        animal_id=_resolve_animal_uuid(db, data.get("animal_id")),
        reportado_por=_to_uuid(data.get("reportado_por")),
        ts_apertura=datetime.now(tz=timezone.utc),
        acciones=[],
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update(db: Session, item: Incidencia, data: dict) -> Incidencia:
    allowed = {"tipo", "subtipo", "severidad", "estado", "titulo", "descripcion",
               "foto_url", "acciones"}
    for key, value in data.items():
        if key == "prioridad":
            item.severidad = value
        elif key == "fecha_resolucion":
            if value:
                try:
                    item.ts_cierre = datetime.fromisoformat(value.replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    pass
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


def _resolve_animal_uuid(db: Session, value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        animal = db.scalar(
            select(Animal).where(
                (Animal.crotal_oficial == value)
                | (Animal.nombre == value)
            )
        )
        return animal.id if animal else None

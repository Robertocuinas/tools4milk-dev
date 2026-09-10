import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import NivelAlerta
from app.models.tools4milk import Alerta, OperationDedupe
from app.repositories import tasks_repository


def get_all(db: Session, skip: int = 0, limit: int = 50, nivel: str | None = None) -> list[Alerta]:
    query = select(Alerta).order_by(Alerta.ts_generacion.desc())
    if nivel is not None:
        query = query.where(Alerta.nivel == _map_nivel(nivel))
    return list(db.scalars(query.offset(skip).limit(limit)).all())


def get_critical(db: Session) -> list[Alerta]:
    return list(
        db.scalars(select(Alerta).where(Alerta.nivel.in_([NivelAlerta.ALTA])).order_by(Alerta.ts_generacion.desc())).all()
    )


def get_by_animal(db: Session, animal_id: str, skip: int = 0, limit: int = 50) -> list[Alerta]:
    try:
        uid = uuid.UUID(animal_id)
    except (ValueError, AttributeError):
        return []
    return list(
        db.scalars(
            select(Alerta).where(Alerta.animal_id == uid).order_by(Alerta.ts_generacion.desc()).offset(skip).limit(limit)
        ).all()
    )


def get_by_id(db: Session, alert_id: str) -> Alerta | None:
    try:
        uid = uuid.UUID(alert_id)
    except (ValueError, AttributeError):
        return None
    return db.get(Alerta, uid)


def create(db: Session, data: dict) -> Alerta:
    item = Alerta(
        id=uuid.uuid4(),
        nivel=_map_nivel(data.get("severidad") or data.get("nivel", "media")),
        titulo=data.get("tipo_alerta") or data.get("titulo", "Alerta"),
        mensaje=data.get("descripcion") or data.get("mensaje"),
        animal_id=_to_uuid(data.get("animal_id")),
        zona_id=_to_uuid(data.get("zona_id")),
        activa=True,
        ts_generacion=datetime.now(tz=timezone.utc),
        push_whatsapp=False,
        pantalla_tv=True,
        tablet=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def resolve_idempotent(
    db: Session,
    item: Alerta,
    data: dict,
    actor_user_id: uuid.UUID,
    operation_id: uuid.UUID,
    path: str,
) -> tuple[dict, bool]:
    """Resolve an alert atomically using the durable Release 2 contract."""
    from app.services.alerts_service import serialize

    with tasks_repository.operation_lock(actor_user_id, operation_id):
        digest = tasks_repository.request_hash("PATCH", path, data)
        existing = tasks_repository.find_dedupe(db, actor_user_id, operation_id)
        if existing is not None:
            if existing.request_hash != digest:
                body = {
                    "error": {
                        "code": "operation_payload_mismatch",
                        "message": "La operación ya existe con otro payload",
                        "operation_id": str(operation_id),
                    }
                }
                raise tasks_repository.IdempotencyConflict(
                    "operation_payload_mismatch", body["error"]["message"], body
                )
            if existing.response_status != 200:
                error = existing.response_body.get("error", {})
                raise tasks_repository.IdempotencyConflict(
                    str(error.get("code", "operation_rejected")),
                    str(error.get("message", "Operación rechazada")),
                    existing.response_body,
                )
            db.commit()
            return existing.response_body, True

        locked = db.scalar(select(Alerta).where(Alerta.id == item.id).with_for_update())
        if locked is None:
            body = {
                "error": {
                    "code": "not_found",
                    "message": "Alerta no encontrada",
                    "operation_id": str(operation_id),
                }
            }
            raise tasks_repository.IdempotencyConflict(
                "not_found", body["error"]["message"], body
            )

        expected = data["expected_version"]
        if locked.version != expected:
            body = {
                "error": {
                    "code": "stale_version",
                    "message": "La alerta cambió antes de poder resolverse",
                    "operation_id": str(operation_id),
                    "expected_version": expected,
                    "resource": {
                        "id": str(locked.id),
                        "version": locked.version,
                        "estado": serialize(locked)["estado"],
                    },
                }
            }
            db.add(
                OperationDedupe(
                    operation_id=operation_id,
                    actor_user_id=actor_user_id,
                    resource_type="alert",
                    resource_id=locked.id,
                    request_hash=digest,
                    status="rejected",
                    response_status=409,
                    response_body=body,
                )
            )
            db.commit()
            raise tasks_repository.IdempotencyConflict(
                "stale_version", body["error"]["message"], body
            )

        if not locked.activa or locked.ts_resolucion is not None:
            body = {
                "error": {
                    "code": "invalid_transition",
                    "message": "La alerta ya no está pendiente de resolución",
                    "operation_id": str(operation_id),
                    "resource": {
                        "id": str(locked.id),
                        "version": locked.version,
                        "estado": serialize(locked)["estado"],
                    },
                }
            }
            db.add(
                OperationDedupe(
                    operation_id=operation_id,
                    actor_user_id=actor_user_id,
                    resource_type="alert",
                    resource_id=locked.id,
                    request_hash=digest,
                    status="rejected",
                    response_status=409,
                    response_body=body,
                )
            )
            db.commit()
            raise tasks_repository.IdempotencyConflict(
                "invalid_transition", body["error"]["message"], body
            )

        estado = data.get("estado")
        if estado == "revisada":
            locked.activa = False
            locked.ts_resolucion = None
        elif estado and estado != "pendiente":
            locked.activa = False
            if locked.ts_resolucion is None:
                locked.ts_resolucion = datetime.now(tz=timezone.utc)
        elif estado == "pendiente":
            locked.activa = True
            locked.ts_resolucion = None

        locked.version += 1
        db.flush()
        body = {
            "operation_id": str(operation_id),
            "replayed": False,
            "alert": serialize(locked),
        }
        db.add(
            OperationDedupe(
                operation_id=operation_id,
                actor_user_id=actor_user_id,
                resource_type="alert",
                resource_id=locked.id,
                request_hash=digest,
                status="applied",
                response_status=200,
                response_body=body,
            )
        )
        db.commit()
        return body, False


def _map_nivel(nivel: str | NivelAlerta) -> NivelAlerta:
    """Map frontend/API nivel strings to NivelAlerta enum."""
    if isinstance(nivel, NivelAlerta):
        return nivel
    mapping = {
        "baja": NivelAlerta.BAJA,
        "media": NivelAlerta.MEDIA,
        "alta": NivelAlerta.ALTA,
        "critica": NivelAlerta.ALTA,
    }
    return mapping.get(nivel, NivelAlerta.MEDIA)


def _to_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None

import hashlib
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.enums import EstadoTarea, ESTADOS_TAREA_CANONICOS, TRANSICIONES_TAREA
from app.models.tools4milk import OperationDedupe, TareaEjecucion, TareaCatalogo


def get_all(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    estado: str | None = None,
    zona_id: str | None = None,
) -> list[tuple[TareaEjecucion, TareaCatalogo | None]]:
    query = (
        select(TareaEjecucion, TareaCatalogo)
        .outerjoin(TareaCatalogo, TareaEjecucion.catalogo_id == TareaCatalogo.id)
        .order_by(TareaEjecucion.ts_planificada)
    )
    if estado is not None:
        query = query.where(TareaEjecucion.estado == _map_estado(estado))
    if zona_id is not None:
        try:
            query = query.where(TareaEjecucion.zona_id == uuid.UUID(zona_id))
        except (ValueError, AttributeError):
            pass
    rows = db.execute(query.offset(skip).limit(limit)).all()
    return [(row[0], row[1]) for row in rows]


def get_by_id(db: Session, task_id: str) -> tuple[TareaEjecucion, TareaCatalogo | None] | None:
    try:
        uid = uuid.UUID(task_id)
    except (ValueError, AttributeError):
        return None
    row = db.execute(
        select(TareaEjecucion, TareaCatalogo)
        .outerjoin(TareaCatalogo, TareaEjecucion.catalogo_id == TareaCatalogo.id)
        .where(TareaEjecucion.id == uid)
    ).first()
    if row is None:
        return None
    return (row[0], row[1])


def create(db: Session, catalogo_id: uuid.UUID, data: dict) -> tuple[TareaEjecucion, TareaCatalogo | None]:
    ts_planificada = _parse_dt(data.get("fecha_programada")) or datetime.now(tz=timezone.utc)
    item = TareaEjecucion(
        id=uuid.uuid4(),
        catalogo_id=catalogo_id,
        zona_id=_to_uuid(data.get("zona_id")),
        empleado_id=_to_uuid(data.get("empleado_id")),
        estado=_map_estado(data.get("estado", "pendiente")),
        ts_planificada=ts_planificada,
        ts_inicio=_parse_dt(data.get("fecha_ejecucion")),
        ts_fin=_parse_dt(data.get("fecha_fin")),
        duracion_estimada_min=_positive_int(data.get("duracion_estimada_min")),
        duracion_real_min=_non_negative_int(data.get("duracion_real_min")),
        prioridad=_priority(data.get("prioridad", 3)),
        turno_id=_to_uuid(data.get("turno_id")),
        notas=data.get("observaciones") or data.get("notas"),
        creado_en=datetime.now(tz=timezone.utc),
        updated_at=datetime.now(tz=timezone.utc),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    catalogo = db.get(TareaCatalogo, catalogo_id)
    return (item, catalogo)


def update(db: Session, item: TareaEjecucion, data: dict) -> tuple[TareaEjecucion, TareaCatalogo | None]:
    _apply_update(item, data)
    item.version += 1
    item.updated_at = datetime.now(tz=timezone.utc)
    db.commit()
    db.refresh(item)
    catalogo = db.get(TareaCatalogo, item.catalogo_id)
    return (item, catalogo)


def request_hash(method: str, path: str, payload: dict) -> str:
    canonical = json.dumps({"method": method, "path": path, "body": payload}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def find_dedupe(db: Session, actor_user_id: uuid.UUID, operation_id: uuid.UUID) -> OperationDedupe | None:
    # PostgreSQL's unique constraint is not enough: two transactions can both
    # miss the row and one would otherwise surface IntegrityError.  A
    # transaction-scoped advisory lock serializes only this deterministic key.
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"tools4milk:task-operation:{actor_user_id}:{operation_id}"},
        )
    return db.scalar(
        select(OperationDedupe)
        .where(OperationDedupe.actor_user_id == actor_user_id, OperationDedupe.operation_id == operation_id)
        .with_for_update()
    )


class IdempotencyConflict(ValueError):
    def __init__(self, code: str, message: str, payload: dict):
        super().__init__(message)
        self.code = code
        self.message = message
        self.payload = payload


def update_idempotent(db: Session, item: TareaEjecucion, data: dict, actor_user_id: uuid.UUID, operation_id: uuid.UUID, path: str) -> tuple[dict, bool]:
    """Aplica una mutación y persiste su respuesta exacta de forma atómica."""
    from app.services.tasks_service import serialize

    digest = request_hash("PUT", path, data)
    existing = find_dedupe(db, actor_user_id, operation_id)
    if existing is not None:
        if existing.request_hash != digest:
            body = {"error": {"code": "operation_payload_mismatch", "message": "La operación ya existe con otro payload", "operation_id": str(operation_id)}}
            raise IdempotencyConflict("operation_payload_mismatch", body["error"]["message"], body)
        if existing.response_status != 200:
            error = existing.response_body.get("error", {})
            raise IdempotencyConflict(str(error.get("code", "operation_rejected")), str(error.get("message", "Operación rechazada")), existing.response_body)
        return existing.response_body, True

    locked = db.scalar(select(TareaEjecucion).where(TareaEjecucion.id == item.id).with_for_update())
    if locked is None:
        body = {"error": {"code": "not_found", "message": "Tarea no encontrada", "operation_id": str(operation_id)}}
        raise IdempotencyConflict("not_found", body["error"]["message"], body)
    expected = data.get("expected_version")
    if not isinstance(expected, int) or isinstance(expected, bool) or expected <= 0:
        body = {"error": {"code": "invalid_expected_version", "message": "expected_version debe ser un entero positivo", "operation_id": str(operation_id)}}
        raise IdempotencyConflict("invalid_expected_version", body["error"]["message"], body)
    if locked.version != expected:
        resource = {"id": str(locked.id), "version": locked.version, "estado_canonico": _canonical_state(locked.estado).value}
        body = {"error": {"code": "stale_version", "message": "La tarea cambió mientras estaba pendiente", "operation_id": str(operation_id), "resource": resource, "expected_version": expected}}
        db.add(OperationDedupe(operation_id=operation_id, actor_user_id=actor_user_id, resource_id=locked.id, request_hash=digest, status="rejected", response_status=409, response_body=body))
        db.commit()
        raise IdempotencyConflict("stale_version", body["error"]["message"], body)

    _apply_update(locked, {key: value for key, value in data.items() if key != "expected_version"})
    locked.version += 1
    locked.updated_at = datetime.now(tz=timezone.utc)
    db.flush()
    catalogo = db.get(TareaCatalogo, locked.catalogo_id)
    body = {"operation_id": str(operation_id), "replayed": False, "task": serialize(locked, catalogo)}
    db.add(OperationDedupe(operation_id=operation_id, actor_user_id=actor_user_id, resource_id=locked.id, request_hash=digest, status="applied", response_status=200, response_body=body))
    db.commit()
    return body, False


def _apply_update(item: TareaEjecucion, data: dict) -> None:
    if "estado" in data:
        next_state = _map_estado(data["estado"])
        current_state = _canonical_state(item.estado)
        if next_state not in ESTADOS_TAREA_CANONICOS:
            raise ValueError("estado no pertenece al contrato canónico")
        if next_state != current_state and next_state not in TRANSICIONES_TAREA[current_state]:
            current_value = current_state.value if isinstance(current_state, EstadoTarea) else str(current_state)
            next_value = next_state.value if isinstance(next_state, EstadoTarea) else str(next_state)
            raise ValueError(f"transición inválida: {current_value} -> {next_value}")
        item.estado = next_state
    if "fecha_ejecucion" in data:
        item.ts_inicio = _parse_dt(data["fecha_ejecucion"])
    if "fecha_programada" in data:
        item.ts_planificada = _parse_dt(data["fecha_programada"]) or item.ts_planificada
    if "fecha_fin" in data:
        item.ts_fin = _parse_dt(data["fecha_fin"])
    if "duracion_estimada_min" in data:
        item.duracion_estimada_min = _positive_int(data["duracion_estimada_min"])
    if "duracion_real_min" in data:
        item.duracion_real_min = _non_negative_int(data["duracion_real_min"])
    if "prioridad" in data:
        item.prioridad = _priority(data["prioridad"])
    if "turno_id" in data:
        item.turno_id = _to_uuid(data["turno_id"])
    if "observaciones" in data or "notas" in data:
        item.notas = data.get("observaciones") or data.get("notas")
    if "empleado_id" in data or "ejecutado_por" in data:
        item.empleado_id = _to_uuid(data.get("empleado_id") or data.get("ejecutado_por"))
def _map_estado(estado: str | EstadoTarea) -> EstadoTarea:
    """Map frontend/API estado strings to EstadoTarea enum."""
    if isinstance(estado, EstadoTarea):
        return estado
    mapping = {
        "programada": EstadoTarea.PENDIENTE,
        "retrasada": EstadoTarea.PENDIENTE,
        "ejecutada": EstadoTarea.COMPLETADA,
        "cancelada": EstadoTarea.CANCELADA,
        "pendiente": EstadoTarea.PENDIENTE,
        "en_curso": EstadoTarea.EN_CURSO,
        "verificacion": EstadoTarea.VERIFICACION,
        "completada": EstadoTarea.COMPLETADA,
        "vencida": EstadoTarea.PENDIENTE,
    }
    if estado not in mapping:
        raise ValueError(f"estado inválido: {estado}")
    return mapping[estado]


def _map_estado_to_frontend(estado: str | EstadoTarea) -> str:
    """Map EstadoTarea enum to frontend estado string."""
    estado_str = estado.value if isinstance(estado, EstadoTarea) else estado
    mapping = {
        "pendiente": "programada",
        "en_curso": "en_curso",
        "verificacion": "verificacion",
        "completada": "ejecutada",
        "vencida": "retrasada",
        "cancelada": "cancelada",
    }
    return mapping.get(estado_str, estado_str)


def _canonical_state(estado: EstadoTarea | str) -> EstadoTarea:
    if not isinstance(estado, EstadoTarea):
        estado = EstadoTarea(str(estado))
    if estado in {EstadoTarea.VENCIDA, EstadoTarea.CANCELADA}:
        return EstadoTarea.PENDIENTE
    return estado


def _positive_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    parsed = int(value)
    if parsed <= 0:
        raise ValueError("duración estimada debe ser positiva")
    return parsed


def _non_negative_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    parsed = int(value)
    if parsed < 0:
        raise ValueError("duración real no puede ser negativa")
    return parsed


def _priority(value: object) -> int:
    parsed = int(value)
    if parsed < 1 or parsed > 5:
        raise ValueError("prioridad debe estar entre 1 y 5")
    return parsed


def _parse_dt(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _to_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None

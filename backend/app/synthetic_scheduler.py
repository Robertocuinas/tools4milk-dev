"""Scheduler sencillo y reproducible para la demo sintética.

No requiere Redis ni un broker: la identidad de cada recurrencia y ocurrencia
se deriva de versión+seed+escenario+fecha. Reintentar, o ejecutar dos procesos
en paralelo, solo puede crear una fila por clave lógica.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import logging
import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.tools4milk import (
    SchedulerRun,
    SchedulerState,
    SyntheticProvenance,
    OperationDedupe,

    TareaEjecucion,
    TareaRecurrente,
)
from app.synthetic_data import GENERATOR_VERSION, GenerationRequest, generate_dataset
from app.synthetic_loader import _ENTITY_NAMESPACE, _dt, load_base, materialize_events

logger = logging.getLogger("tools4milk.synthetic_scheduler")
STATE_ID = 1


@dataclass(frozen=True)
class SchedulerRequest:
    profile: str = "small"
    seed: int = 20260602
    scenario: str = "normal"
    simulation_time: str = "2026-06-01T12:00:00+00:00"
    generated_at: str = "2026-06-01T12:00:00+00:00"
    horizon_days: int = 7

    def generation(self) -> GenerationRequest:
        return GenerationRequest(self.profile, self.seed, self.scenario, self.simulation_time, self.generated_at)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _insert_once(db: Session, model: Any, item: Any) -> bool:
    """Inserta con savepoint: una carrera que gana otra sesión se omite."""
    try:
        with db.begin_nested():
            db.add(item)
            db.flush()
        return True
    except IntegrityError:
        return False


def _state(db: Session) -> SchedulerState:
    item = db.get(SchedulerState, STATE_ID)
    if item is None:
        item = SchedulerState(id=STATE_ID, updated_at=_now())
        if not _insert_once(db, SchedulerState, item):
            item = db.get(SchedulerState, STATE_ID)
    if item is None:
        raise RuntimeError("scheduler state could not be created")
    return item


def _recurrence_rows(db: Session, dataset: dict[str, Any], simulation_date: date) -> list[TareaRecurrente]:
    rows: list[TareaRecurrente] = []
    for task in dataset.get("tasks", []):
        catalog_id = uuid.uuid5(_ENTITY_NAMESPACE, f"catalog:{task['title']}")
        recurrence_id = uuid.uuid5(_ENTITY_NAMESPACE, f"recurrence:{dataset['manifest']['scenario_id']}:{catalog_id}")
        existing = db.get(TareaRecurrente, recurrence_id)
        if existing is None:
            existing = TareaRecurrente(
                id=recurrence_id,
                catalogo_id=catalog_id,
                zona_id=uuid.UUID(task["zone_id"]) if task.get("zone_id") else None,
                frecuencia_expr="daily",
                descripcion_frecuencia="Cada día (escenario sintético)",
                activa=True,
                fecha_inicio=simulation_date,
                notas=f"synthetic:{dataset['manifest']['scenario_id']}:{dataset['manifest']['random_seed']}",
            )
            if _insert_once(db, TareaRecurrente, existing):
                rows.append(existing)
        else:
            rows.append(existing)
    return rows


def _occurrence_id(recurrence_id: uuid.UUID, occurrence_date: date) -> uuid.UUID:
    return uuid.uuid5(_ENTITY_NAMESPACE, f"occurrence:{recurrence_id}:{occurrence_date.isoformat()}")


def materialize_recurrences(db: Session, dataset: dict[str, Any], horizon_days: int = 7) -> dict[str, int]:
    """Materializa definiciones y ocurrencias diarias de forma idempotente."""
    if not 1 <= horizon_days <= 365:
        raise ValueError("horizon_days debe estar entre 1 y 365")
    simulation_date = date.fromisoformat(dataset["manifest"]["simulation_time"][:10])
    created = skipped = 0
    with db.begin():
        recurrences = _recurrence_rows(db, dataset, simulation_date)

        for recurrence in recurrences:
            task = next((row for row in dataset["tasks"] if uuid.UUID(row["zone_id"]) == recurrence.zona_id), None)
            if task is None:
                continue
            for offset in range(horizon_days):
                occurrence_date = simulation_date + timedelta(days=offset)
                occurrence_id = _occurrence_id(recurrence.id, occurrence_date)
                if db.get(TareaEjecucion, occurrence_id) is not None:
                    skipped += 1
                    continue
                planned = datetime.combine(occurrence_date, datetime.min.time(), tzinfo=timezone.utc)
                item = TareaEjecucion(
                    id=occurrence_id,
                    catalogo_id=recurrence.catalogo_id,
                    recurrente_id=recurrence.id,
                    empleado_id=uuid.UUID(task["employee_id"]) if task.get("employee_id") else None,
                    zona_id=recurrence.zona_id,
                    estado="pendiente",
                    ts_planificada=planned,
                    duracion_estimada_min=30,
                    prioridad=3,
                    creado_en=_dt(dataset["manifest"]["generated_at"]),
                )
                if _insert_once(db, TareaEjecucion, item):
                    created += 1
                else:
                    skipped += 1
                provenance_id = uuid.uuid5(_ENTITY_NAMESPACE, f"provenance:recurring_task:{occurrence_id}")
                if db.scalar(select(SyntheticProvenance).where(
                    SyntheticProvenance.entity_type == "recurring_task",
                    SyntheticProvenance.entity_id == occurrence_id,
                )) is None:
                    _insert_once(db, SyntheticProvenance, SyntheticProvenance(
                        id=provenance_id,
                        entity_type="recurring_task",
                        entity_id=occurrence_id,
                        source="synthetic/generated",
                        generator_version=GENERATOR_VERSION,
                        scenario_id=dataset["manifest"]["scenario_id"],
                        random_seed=int(dataset["manifest"]["random_seed"]),
                        generated_at=_dt(dataset["manifest"]["generated_at"]),
                        simulation_time=planned,
                        payload={"recurrence_id": str(recurrence.id), "occurrence_date": occurrence_date.isoformat()},
                    ))
    return {"created": created, "skipped": skipped, "errors": 0, "recurrences": len(recurrences)}


def scheduler_status(db: Session) -> dict[str, Any]:
    item = _state(db)
    return {
        "paused": item.paused,
        "last_execution": {
            "started_at": item.last_started_at.isoformat() if item.last_started_at else None,
            "finished_at": item.last_finished_at.isoformat() if item.last_finished_at else None,
            "duration_ms": item.last_duration_ms,
            "created": item.last_created,
            "skipped": item.last_skipped,
            "errors": item.last_errors,
            "error": item.last_error,
        },
    }


def set_paused(db: Session, paused: bool) -> dict[str, Any]:
    if db.in_transaction():
        db.commit()
    with db.begin():
        item = _state(db)
        item.paused = paused
        item.updated_at = _now()
    return scheduler_status(db)


def run_once(db: Session, request: SchedulerRequest = SchedulerRequest()) -> dict[str, Any]:
    started = _now()
    state = _state(db)
    paused = state.paused
    db.commit()
    if paused:
        return {"status": "paused", **scheduler_status(db)}
    start_clock = time.perf_counter()
    result: dict[str, Any]
    error_class: str | None = None
    try:
        dataset = generate_dataset(request.generation())
        load_base(db, dataset)
        materialize_events(db, dataset)
        recurrence_result = materialize_recurrences(db, dataset, request.horizon_days)
        result = {"status": "ok", **recurrence_result}
    except Exception as exc:
        db.rollback()
        error_class = exc.__class__.__name__
        logger.exception("scheduler run failed: %s", error_class)
        result = {"status": "error", "created": 0, "skipped": 0, "errors": 1, "error": error_class}
    finished = _now()
    duration_ms = int((time.perf_counter() - start_clock) * 1000)
    with db.begin():
        item = _state(db)
        item.last_started_at = started
        item.last_finished_at = finished
        item.last_duration_ms = duration_ms
        item.last_created = int(result.get("created", 0))
        item.last_skipped = int(result.get("skipped", 0))
        item.last_errors = int(result.get("errors", 0))
        item.last_error = str(result.get("error")) if result.get("error") else None
        item.updated_at = finished
        db.add(SchedulerRun(
            started_at=started, finished_at=finished, duration_ms=duration_ms,
            profile=request.profile, scenario=request.scenario, seed=request.seed,
            created=item.last_created, skipped=item.last_skipped, errors=item.last_errors,
            error_class=error_class,
        ))
    return {**result, "duration_ms": duration_ms, "finished_at": finished.isoformat()}


def reset_synthetic(db: Session) -> dict[str, int]:
    """Elimina materialización sintética y sus deduplicaciones de demo."""
    if db.in_transaction():
        db.commit()
    with db.begin():
        provenance_ids = [row.entity_id for row in db.scalars(select(SyntheticProvenance).where(SyntheticProvenance.source == "synthetic/generated")).all()]
        recurrence_ids = [row.id for row in db.scalars(select(TareaRecurrente).where(TareaRecurrente.notas.like("synthetic:%"))).all()]
        deleted_tasks = db.query(TareaEjecucion).filter(TareaEjecucion.id.in_(provenance_ids)).delete(synchronize_session=False) if provenance_ids else 0
        deleted_prov = db.query(SyntheticProvenance).filter(SyntheticProvenance.source == "synthetic/generated").delete(synchronize_session=False)
        deleted_rec = db.query(TareaRecurrente).filter(TareaRecurrente.id.in_(recurrence_ids)).delete(synchronize_session=False) if recurrence_ids else 0
        # operation_dedupe has no TTL by design; an administered synthetic
        # reset must remove only rows tied to reset materialization.
        dedupe_ids = [row.resource_id for row in db.scalars(select(OperationDedupe).where(OperationDedupe.resource_id.in_(provenance_ids))).all()] if provenance_ids else []
        deleted_dedupe = db.query(OperationDedupe).filter(OperationDedupe.resource_id.in_(dedupe_ids)).delete(synchronize_session=False) if dedupe_ids else 0
    return {"tasks": int(deleted_tasks), "recurrences": int(deleted_rec), "provenance": int(deleted_prov), "operation_dedupe": int(deleted_dedupe)}
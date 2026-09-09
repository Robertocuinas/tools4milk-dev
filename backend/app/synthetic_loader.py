"""Adaptador transaccional del contrato JSON sintético a LeanFarming.

Separa dos fases deliberadamente:
- ``load_base``: zonas, empleados, catálogo y provenance del dataset.
- ``materialize_events``: turnos, asignaciones y ejecuciones de tareas.

No calcula disponibilidad ni agenda: las asignaciones son las que vienen en el
contrato o, en el caso del generador Release 1, un reparto determinista explícito
para que la demo sea reproducible. Todas las escrituras son idempotentes por ID.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import EstadoTarea, RolEmpleado, TipoTurno
from app.models.tools4milk import (
    AsignacionTurno,
    Empleado,
    SyntheticProvenance,
    TareaCatalogo,
    TareaEjecucion,
    Turno,
    Zona,
)

_ENTITY_NAMESPACE = uuid.UUID("5f0fbd9e-a4aa-4d51-9b6e-5b9f8b4e5ab1")


def _uuid(value: str) -> uuid.UUID:
    return uuid.UUID(str(value))


def _dt(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _date(value: str) -> date:
    return date.fromisoformat(value[:10])


def _provenance(db: Session, entity_type: str, row: dict[str, Any]) -> None:
    marker = row.get("provenance")
    if not marker:
        raise ValueError(f"{entity_type} {row.get('id')} carece de provenance sintético")
    entity_id = _uuid(row["id"])
    existing = db.scalar(
        select(SyntheticProvenance).where(
            SyntheticProvenance.entity_type == entity_type,
            SyntheticProvenance.entity_id == entity_id,
        )
    )
    if existing is None:
        db.add(SyntheticProvenance(
            id=uuid.uuid5(_ENTITY_NAMESPACE, f"provenance:{entity_type}:{entity_id}"),
            entity_type=entity_type,
            entity_id=entity_id,
            source=marker["source"],
            generator_version=marker["generator_version"],
            scenario_id=marker["scenario_id"],
            random_seed=int(marker["random_seed"]),
            generated_at=_dt(marker["generated_at"]),
            simulation_time=_dt(marker["simulation_time"]),
            payload=row,
        ))


def _employee_role(value: str) -> RolEmpleado:
    return {
        "supervisor": RolEmpleado.ENCARGADO,
        "operator": RolEmpleado.AUXILIAR,
        "encargado": RolEmpleado.ENCARGADO,
        "auxiliar": RolEmpleado.AUXILIAR,
        "veterinario": RolEmpleado.VETERINARIO,
        "mecanico": RolEmpleado.MECANICO,
    }.get(value, RolEmpleado.AUXILIAR)


def load_base(db: Session, dataset: dict[str, Any]) -> dict[str, int]:
    """Materializa maestros y provenance en una única transacción."""
    with db.begin():
        zone_id_aliases: dict[str, str] = {}
        for row in dataset.get("zones", []):
            original_id = str(row["id"])
            entity_id = _uuid(original_id)
            item = db.get(Zona, entity_id)
            if item is None:
                # ``database/init.sql`` may already contain the canonical
                # demo zone. Reuse it by its unique name instead of trying
                # to insert a second row with the synthetic UUID.
                item = db.scalar(select(Zona).where(Zona.nombre == row["name"]))
                if item is None:
                    item = Zona(id=entity_id, nombre=row["name"], codigo=row["code"])
                    db.add(item)
                else:
                    row["id"] = str(item.id)
                    zone_id_aliases[original_id] = str(item.id)
            _provenance(db, "zone", row)

        # Event rows refer to the contract IDs. Keep their foreign keys
        # aligned when a canonical init.sql zone was reused above.
        if zone_id_aliases:
            for collection in ("tasks", "shifts", "assignments"):
                for row in dataset.get(collection, []):
                    if row.get("zone_id") in zone_id_aliases:
                        row["zone_id"] = zone_id_aliases[row["zone_id"]]

        for row in dataset.get("employees", []):
            entity_id = _uuid(row["id"])
            item = db.get(Empleado, entity_id)
            name_parts = str(row["name"]).split(" ", 1)
            if item is None:
                item = Empleado(
                    id=entity_id,
                    nombre=name_parts[0][:100],
                    apellidos=(name_parts[1] if len(name_parts) > 1 else "Sintético")[:150],
                    rol=_employee_role(str(row.get("role", "operator"))),
                    fecha_alta=date.today(),
                )
                db.add(item)
            _provenance(db, "employee", row)

        for row in dataset.get("tasks", []):
            catalog_id = uuid.uuid5(_ENTITY_NAMESPACE, f"catalog:{row['title']}")
            item = db.get(TareaCatalogo, catalog_id)
            if item is None:
                item = TareaCatalogo(
                    id=catalog_id,
                    codigo=f"synthetic-{catalog_id.hex[:16]}",
                    nombre=str(row["title"])[:150],
                    descripcion="Catálogo derivado del contrato sintético",
                    duracion_estimada_min=30,
                )
                db.add(item)
            _provenance(db, "task_catalog", {**row, "id": str(catalog_id)})
    return {
        "zones": len(dataset.get("zones", [])),
        "employees": len(dataset.get("employees", [])),
        "catalog": len({row["title"] for row in dataset.get("tasks", [])}),
    }


def _canonical_status(value: str) -> EstadoTarea:
    return {
        "programada": EstadoTarea.PENDIENTE,
        "pendiente": EstadoTarea.PENDIENTE,
        "retrasada": EstadoTarea.PENDIENTE,
        "en_curso": EstadoTarea.EN_CURSO,
        "verificacion": EstadoTarea.VERIFICACION,
        "completada": EstadoTarea.COMPLETADA,
        "ejecutada": EstadoTarea.COMPLETADA,
    }.get(value, EstadoTarea.PENDIENTE)


def materialize_events(db: Session, dataset: dict[str, Any]) -> dict[str, int]:
    """Materializa turnos, asignaciones y tareas; repetir es seguro."""
    employees = [_uuid(row["id"]) for row in dataset.get("employees", [])]
    zone_ids = [_uuid(row["id"]) for row in dataset.get("zones", [])]
    with db.begin():
        for row in dataset.get("shifts", []):
            shift_id = _uuid(row["id"])
            item = db.get(Turno, shift_id)
            if item is None:
                item = Turno(
                    id=shift_id,
                    fecha=_date(row["date"]),
                    tipo_turno=TipoTurno(row["type"]),
                    hora_inicio=time.fromisoformat(row["start"]),
                    hora_fin=time.fromisoformat(row["end"]),
                )
                db.add(item)
            _provenance(db, "shift", row)

        # No ORM relationship links ``AsignacionTurno.turno_id`` to the
        # just-created ``Turno`` rows, so make the parent inserts visible to
        # PostgreSQL before adding child assignments.
        db.flush()

        for index, row in enumerate(dataset.get("shifts", [])):
            if not employees:
                continue
            shift_id = _uuid(row["id"])
            employee_id = employees[index % len(employees)]
            assignment_id = uuid.uuid5(_ENTITY_NAMESPACE, f"assignment:{shift_id}:{employee_id}")
            if db.get(AsignacionTurno, assignment_id) is None:
                db.add(AsignacionTurno(
                    id=assignment_id,
                    turno_id=shift_id,
                    empleado_id=employee_id,
                    zona_id=zone_ids[index % len(zone_ids)] if zone_ids else None,
                    rol="asignación sintética determinista",
                ))
            _provenance(db, "shift_assignment", {
                "id": str(assignment_id),
                "provenance": row["provenance"],
                "turno_id": str(shift_id),
                "empleado_id": str(employee_id),
            })

        for row in dataset.get("tasks", []):
            task_id = _uuid(row["id"])
            catalog_id = uuid.uuid5(_ENTITY_NAMESPACE, f"catalog:{row['title']}")
            item = db.get(TareaEjecucion, task_id)
            if item is None:
                item = TareaEjecucion(
                    id=task_id,
                    catalogo_id=catalog_id,
                    empleado_id=_uuid(row["employee_id"]) if row.get("employee_id") else None,
                    zona_id=_uuid(row["zone_id"]) if row.get("zone_id") else None,
                    estado=_canonical_status(str(row.get("status", "pendiente"))),
                    ts_planificada=_dt(row["planned_at"]),
                    duracion_estimada_min=30,
                    prioridad=3,
                    creado_en=_dt(row["provenance"]["generated_at"]),
                )
                db.add(item)
            _provenance(db, "task", row)
    return {
        "shifts": len(dataset.get("shifts", [])),
        "assignments": len(dataset.get("shifts", [])),
        "tasks": len(dataset.get("tasks", [])),
    }


def load_dataset(db: Session, dataset: dict[str, Any]) -> dict[str, dict[str, int]]:
    """Contrato único para carga base + materialización de eventos."""
    return {"base": load_base(db, dataset), "events": materialize_events(db, dataset)}

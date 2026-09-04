from typing import Any

from app.models.tools4milk import AsignacionTurno, Turno


def serialize_turno(t: Turno) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "fecha": t.fecha.isoformat() if t.fecha else None,
        "tipo_turno": t.tipo_turno,
        "hora_inicio": t.hora_inicio.isoformat() if t.hora_inicio else None,
        "hora_fin": t.hora_fin.isoformat() if t.hora_fin else None,
        "notas": t.notas,
    }


def serialize_asignacion(a: AsignacionTurno) -> dict[str, Any]:
    return {
        "id": str(a.id),
        "turno_id": str(a.turno_id),
        "empleado_id": str(a.empleado_id),
        "zona_id": str(a.zona_id) if a.zona_id else None,
        "rol": a.rol,
    }

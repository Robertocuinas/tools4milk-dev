from typing import Any

from app.models.tools4milk import ResumenRelevo


def serialize(r: ResumenRelevo) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "turno_saliente_id": str(r.turno_saliente_id),
        "turno_entrante_id": str(r.turno_entrante_id),
        "ts_generacion": r.ts_generacion.isoformat() if r.ts_generacion else None,
        "incidencias_abiertas": r.incidencias_abiertas or [],
        "tareas_pendientes": r.tareas_pendientes or [],
        "alertas_pendientes": r.alertas_pendientes or [],
        "notas_saliente": r.notas_saliente,
        "confirmado_por": str(r.confirmado_por) if r.confirmado_por else None,
        "ts_confirmacion": r.ts_confirmacion.isoformat() if r.ts_confirmacion else None,
    }

from typing import Any
from app.enums import EstadoTarea
from app.models.tools4milk import TareaEjecucion, TareaCatalogo
from app.repositories.tasks_repository import _map_estado_to_frontend


def serialize(ejecucion: TareaEjecucion, catalogo: TareaCatalogo | None) -> dict[str, Any]:
    estado_frontend = _map_estado_to_frontend(ejecucion.estado)
    estado_value = ejecucion.estado.value if isinstance(ejecucion.estado, EstadoTarea) else str(ejecucion.estado)
    return {
        "id": str(ejecucion.id),
        "tarea_catalogo_id": str(ejecucion.catalogo_id) if ejecucion.catalogo_id else None,
        "tarea_catalogo": {
            "id": str(catalogo.id) if catalogo else str(ejecucion.catalogo_id),
            "nombre": catalogo.nombre if catalogo else "Tarea",
            "categoria": None,
            "frecuencia": None,
            "zona_aplicable": None,
        } if catalogo or ejecucion.catalogo_id else None,
        "zona_id": str(ejecucion.zona_id) if ejecucion.zona_id else None,
        "empleado_id": str(ejecucion.empleado_id) if ejecucion.empleado_id else None,
        "fecha_programada": ejecucion.ts_planificada.isoformat() if ejecucion.ts_planificada else None,
        "fecha_ejecucion": ejecucion.ts_inicio.isoformat() if ejecucion.ts_inicio else None,
        "estado": estado_frontend,
        "estado_canonico": estado_value if estado_value in {"pendiente", "en_curso", "verificacion", "completada"} else "pendiente",
        "ejecutado_por": str(ejecucion.empleado_id) if ejecucion.empleado_id else None,
        "tiempo_ejecucion_minutos": None,
        "duracion_estimada_min": ejecucion.duracion_estimada_min,
        "duracion_real_min": ejecucion.duracion_real_min,
        "prioridad": ejecucion.prioridad,
        "turno_id": str(ejecucion.turno_id) if ejecucion.turno_id else None,
        "fecha_fin": ejecucion.ts_fin.isoformat() if ejecucion.ts_fin else None,
        "resultado": None,
        "observaciones": ejecucion.notas,
        "problemas_encontrados": None,
        "acciones_correctivas": None,
        "checklist_completado": "true" if ejecucion.estado == EstadoTarea.COMPLETADA else "false",
        "checklist_datos": None,
        "es_urgente": ejecucion.estado in {EstadoTarea.VENCIDA},
        "motivo_retraso": None,
        "requiere_seguimiento": ejecucion.estado in {EstadoTarea.VENCIDA},
        "fecha_seguimiento": None,
        "version": ejecucion.version,
        "updated_at": ejecucion.updated_at.isoformat() if ejecucion.updated_at else None,
    }

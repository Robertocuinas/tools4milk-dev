from datetime import date
from typing import Any

from app.models.tools4milk import Lactacion


def serialize(l: Lactacion) -> dict[str, Any]:
    activa = l.fecha_secado is None
    dias = None
    if l.fecha_parto:
        ref = l.fecha_secado or date.today()
        dias = (ref - l.fecha_parto).days

    return {
        "id": str(l.id),
        "animal_id": str(l.animal_id),
        "numero_lactacion": l.numero,
        "fecha_inicio": l.fecha_parto.isoformat() if l.fecha_parto else None,
        "fecha_fin": l.fecha_secado.isoformat() if l.fecha_secado else None,
        "dias_transcurridos": dias,
        "produccion_promedio": round(float(l.produccion_total_kg) / 305, 1) if l.produccion_total_kg else None,
        "produccion_total": float(l.produccion_total_kg) if l.produccion_total_kg else None,
        "grasa_promedio": float(l.grasa_promedio) if l.grasa_promedio is not None else None,
        "proteina_promedio": float(l.proteina_promedio) if l.proteina_promedio is not None else None,
        "rcs_promedio": l.rcs_promedio,
        "activa": activa,
    }


def quality_summary(lactaciones: list[Lactacion]) -> dict[str, Any]:
    if not lactaciones:
        return {
            "lactaciones_activas": 0,
            "produccion_promedio": None,
            "grasa_promedio": None,
            "proteina_promedio": None,
            "rcs_promedio": None,
            "animales_en_control": 0,
        }
    return {
        "lactaciones_activas": len(lactaciones),
        "produccion_promedio": round(
            sum(float(l.produccion_total_kg or 0) / 305 for l in lactaciones) / len(lactaciones),
            1,
        ),
        "grasa_promedio": round(sum(float(l.grasa_promedio) for l in lactaciones if l.grasa_promedio) / max(1, sum(1 for l in lactaciones if l.grasa_promedio)), 2) or None,
        "proteina_promedio": round(sum(float(l.proteina_promedio) for l in lactaciones if l.proteina_promedio) / max(1, sum(1 for l in lactaciones if l.proteina_promedio)), 2) or None,
        "rcs_promedio": round(sum(l.rcs_promedio for l in lactaciones if l.rcs_promedio) / max(1, sum(1 for l in lactaciones if l.rcs_promedio))) if any(l.rcs_promedio for l in lactaciones) else None,
        "animales_en_control": len({str(l.animal_id) for l in lactaciones}),
    }

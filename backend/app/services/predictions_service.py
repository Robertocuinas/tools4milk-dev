"""Predicciones operativas mediante heurísticas aritméticas.

IMPORTANTE: no hay modelos de machine learning. Las estimaciones se derivan de la
producción de la lactación activa y de penalizaciones por tratamientos/alertas. Los
índices de confianza son constantes orientativas y la composición es un placeholder
(se devuelve 0), no un cálculo real.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tools4milk import Alerta, TratamientoActivo
from app.repositories import animals_repository, lactations_repository
from app.time_utils import utc_now


def compute_prediction(db: Session, animal: Any) -> dict[str, Any]:
    lactation = lactations_repository.get_active_for_animal(db, str(animal.id))
    active_treatments = db.scalars(
        select(TratamientoActivo).where(TratamientoActivo.animal_id == animal.id, TratamientoActivo.activo.is_(True))
    ).all()
    pending_alerts = db.scalars(
        select(Alerta).where(Alerta.animal_id == animal.id, Alerta.activa.is_(True))
    ).all()

    base_production = (
        float(lactation.produccion_total_kg) / 305
        if lactation and lactation.produccion_total_kg
        else 0
    )
    treatment_penalty = 0.08 if active_treatments else 0
    alert_penalty = min(len(pending_alerts) * 0.03, 0.12)
    expected = round(base_production * (1 - treatment_penalty - alert_penalty), 1) if base_production else 0
    trend = "descenso" if treatment_penalty or alert_penalty else "estable"
    series = [round(expected * factor, 1) for factor in [0.98, 0.99, 1.0, 1.01, 1.0, 1.02, 1.01]]

    risk_level = "alto" if active_treatments else "medio" if pending_alerts else "bajo"
    risk_factors = []
    if active_treatments:
        risk_factors.append("Tratamiento activo")
    if pending_alerts:
        risk_factors.append("Alertas pendientes")

    return {
        "animal_id": str(animal.id),
        "timestamp": utc_now().isoformat(),
        "produccion": {
            "tendencia": trend,
            "produccion_promedio_predicha": expected,
            "produccion_minima_predicha": round(expected * 0.93, 1),
            "produccion_maxima_predicha": round(expected * 1.07, 1),
            "dias_prediccion": 7,
            "confidence": 0.82 if lactation else 0.45,
            "series_diaria": series,
        },
        "composicion": {
            "grasa": {"prediccion": 0, "tendencia": "estable"},
            "proteina": {"prediccion": 0, "tendencia": "estable"},
            "lactosa": {"prediccion": 0, "tendencia": "estable"},
            "anomalia_detectada": False,
            "confidence": 0.79 if lactation else 0.42,
        },
        "riesgo_sanitario": {
            "riesgo_promedio": risk_level,
            "riesgos_especificos": {
                "mastitis": {
                    "probabilidad": 0.18,
                    "nivel": "bajo",
                }
            },
            "factores_riesgo": risk_factors,
            "confidence": 0.84 if lactation else 0.5,
            "dias_prediccion": 7,
        },
        "confianza_integrada": 0.82 if lactation else 0.46,
        "_mock": False,
    }


def get_animal_or_none(db: Session, animal_id: str) -> Any:
    return animals_repository.get_by_id(db, animal_id) or animals_repository.get_by_crotal(db, animal_id)

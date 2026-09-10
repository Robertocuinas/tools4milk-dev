"""Asociación descriptiva meteo ↔ producción sobre datos sintéticos (Release 4 DSS).

Solo estadística descriptiva determinista. No hay modelos ML, no hay
causalidad y no se predice nada: se describe la co-variación observada entre
las medias diarias de ``lecturas_meteorologia`` y de ``lecturas_robot_ordeno``
(propiedades agregadas por fecha natural).

Método: correlación de Pearson sobre pares diarios (x = variable meteo del
día, y = producción media del día)::

    r = Σ((x - mx)(y - my)) / sqrt(Σ(x - mx)² · Σ(y - my)²)

Si el denominador es 0 (serie constante) o hay menos de ``MIN_SAMPLE_SIZE``
días emparejados, se devuelve ``status="insufficient_data"`` con
``asociaciones=[]``. Nunca se inventan resultados.
"""

from __future__ import annotations

import math
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.contracts import provenance
from app.models.tools4milk import LecturaMeteo, LecturaRobotOrdeno
from app.time_utils import utc_now

UBICACION = "Villalba, Lugo"
METODO = "pearson_descriptivo"
FORMULA = (
    "r = Σ((x - mx)(y - my)) / sqrt(Σ(x - mx)² · Σ(y - my)²); "
    "x = media diaria meteo, y = producción media diaria (kg), "
    "n = días naturales emparejados con ambas observaciones"
)
MIN_SAMPLE_SIZE = 5
AVISO = (
    "Asociación descriptiva sobre datos sintéticos; no implica causalidad "
    "ni validez predictiva, clínica o productiva"
)


def _pearson(pairs: list[tuple[float, float]]) -> tuple[float | None, float | None, float | None]:
    """Devuelve (r, media_x, media_y); r=None si no es computable."""
    n = len(pairs)
    if n < MIN_SAMPLE_SIZE:
        return None, None, None
    mx = sum(x for x, _ in pairs) / n
    my = sum(y for _, y in pairs) / n
    num = sum((x - mx) * (y - my) for x, y in pairs)
    den_x = sum((x - mx) ** 2 for x, _ in pairs)
    den_y = sum((y - my) ** 2 for _, y in pairs)
    den = math.sqrt(den_x * den_y)
    if den == 0:
        return None, round(mx, 3), round(my, 3)
    return round(num / den, 4), round(mx, 3), round(my, 3)


def _interpretacion(r: float | None, n: int) -> str:
    if r is None:
        return (
            f"n={n}: serie constante o sin variabilidad; "
            "no se puede describir asociación lineal"
        )
    magnitud = "débil" if abs(r) < 0.3 else "moderada" if abs(r) < 0.7 else "fuerte"
    sentido = "positiva" if r > 0 else "negativa" if r < 0 else "nula"
    return (
        f"n={n}: co-variación lineal observada {magnitud} y {sentido} "
        f"(r={r}); describe solo los días incluidos, sin implicar causalidad"
    )


def compute_correlation(
    db: Session, ventana_dias: int = 30, dias_adelante: int = 7
) -> dict[str, Any]:
    """Calcula la asociación descriptiva meteo ↔ producción.

    Agrega por fecha natural (media diaria) las dos series y las empareja por
    día. Determinista: mismo contenido de BD → mismo resultado.
    """
    cutoff = utc_now() - timedelta(days=ventana_dias)

    meteo_rows = db.execute(
        select(
            func.date(LecturaMeteo.ts).label("dia"),
            func.avg(LecturaMeteo.temperatura_c).label("temp"),
            func.avg(LecturaMeteo.humedad_relativa).label("hum"),
            func.max(LecturaMeteo.fuente).label("fuente"),
        )
        .where(LecturaMeteo.ts >= cutoff)
        .group_by(func.date(LecturaMeteo.ts))
    ).all()

    prod_rows = db.execute(
        select(
            func.date(LecturaRobotOrdeno.ts).label("dia"),
            func.avg(LecturaRobotOrdeno.produccion_kg).label("prod"),
        )
        .where(
            LecturaRobotOrdeno.ts >= cutoff,
            LecturaRobotOrdeno.produccion_kg.is_not(None),
        )
        .group_by(func.date(LecturaRobotOrdeno.ts))
    ).all()

    prod_by_day = {str(r.dia): float(r.prod) for r in prod_rows if r.prod is not None}
    temp_pairs: list[tuple[float, float]] = []
    hum_pairs: list[tuple[float, float]] = []
    dias_con_temp: set[str] = set()
    dias_con_hum: set[str] = set()
    for r in meteo_rows:
        key = str(r.dia)
        if key not in prod_by_day:
            continue
        y = prod_by_day[key]
        if r.temp is not None:
            temp_pairs.append((float(r.temp), y))
            dias_con_temp.add(key)
        if r.hum is not None:
            hum_pairs.append((float(r.hum), y))
            dias_con_hum.add(key)

    fuentes = {str(r.fuente) for r in meteo_rows if r.fuente}
    fuente = "aemet_real" if "aemet_real" in fuentes or "aemet" in fuentes else "generated"

    dias_temp = len(temp_pairs)
    dias_hum = len(hum_pairs)
    # Días naturales con las tres observaciones (temperatura, humedad y
    # producción): soporte real del análisis conjunto.
    sample_size = len(dias_con_temp & dias_con_hum)

    if sample_size < MIN_SAMPLE_SIZE:
        return {
            "ubicacion": UBICACION,
            "dias_adelante": dias_adelante,
            "ventana_dias": ventana_dias,
            "metodo": METODO,
            "formula": FORMULA,
            "status": "insufficient_data",
            "sample_size": sample_size,
            "min_sample_size": MIN_SAMPLE_SIZE,
            "asociaciones": [],
            "impactos_predichos": [],
            "aviso": AVISO,
            "provenance": provenance(fuente),
        }

    r_temp, m_temp, m_prod_t = _pearson(temp_pairs)
    r_hum, m_hum, m_prod_h = _pearson(hum_pairs)

    asociaciones = [
        {
            "variable_meteo": "temperatura_c_media_diaria",
            "variable_productiva": "produccion_kg_media_diaria",
            "n": dias_temp,
            "pearson_r": r_temp,
            "media_meteo": m_temp,
            "media_productiva": m_prod_t,
            "interpretacion": _interpretacion(r_temp, dias_temp),
        },
        {
            "variable_meteo": "humedad_relativa_media_diaria",
            "variable_productiva": "produccion_kg_media_diaria",
            "n": dias_hum,
            "pearson_r": r_hum,
            "media_meteo": m_hum,
            "media_productiva": m_prod_h,
            "interpretacion": _interpretacion(r_hum, dias_hum),
        },
    ]
    return {
        "ubicacion": UBICACION,
        "dias_adelante": dias_adelante,
        "ventana_dias": ventana_dias,
        "metodo": METODO,
        "formula": FORMULA,
        "status": "sufficient",
        "sample_size": sample_size,
        "min_sample_size": MIN_SAMPLE_SIZE,
        "asociaciones": asociaciones,
        "impactos_predichos": [],
        "aviso": AVISO,
        "provenance": provenance(fuente),
    }

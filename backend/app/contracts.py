"""Contratos explícitos para datos sintéticos y estimaciones experimentales."""

from typing import Any, Literal


CanonicalSource = Literal["generated", "aemet_real"]


def canonical_source(source: str | None) -> CanonicalSource:
    """Normaliza valores históricos al vocabulario público de provenance."""
    normalized = (source or "").strip().lower()
    if normalized in {"aemet", "aemet_real"}:
        return "aemet_real"
    return "generated"


def provenance(source: str | None) -> dict[str, Any]:
    """Return a stable provenance marker suitable for API responses."""
    canonical = canonical_source(source)
    synthetic = canonical == "generated"
    return {
        "source": canonical,
        "mode": "synthetic" if synthetic else "real",
        "synthetic": synthetic,
    }


PREDICTION_LIMITATIONS = [
    "Heurística aritmética experimental; no es un modelo de machine learning.",
    "validated=false: no existe validación calibrada ni evaluación en campo.",
    "No constituye recomendación clínica, productiva ni veterinaria.",
]
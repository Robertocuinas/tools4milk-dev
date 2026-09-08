"""Contratos explícitos para datos sintéticos y estimaciones experimentales."""

from typing import Any


def provenance(source: str) -> dict[str, Any]:
    """Return a stable provenance marker suitable for API responses."""
    synthetic = source == "generated"
    return {
        "source": source,
        "mode": "synthetic" if synthetic else "real",
        "synthetic": synthetic,
    }


PREDICTION_LIMITATIONS = [
    "Heurística aritmética experimental; no es un modelo de machine learning.",
    "validated=false: no existe validación calibrada ni evaluación en campo.",
    "No constituye recomendación clínica, productiva ni veterinaria.",
]
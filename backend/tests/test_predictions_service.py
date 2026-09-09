"""Tests para predictions_service.compute_prediction.

Cubre los contratos públicos del servicio:
  - Sin lactancia activa -> confianza degradada, sin serie diaria
  - Con lactancia activa -> confianza estándar, serie de 7 días
  - Con tratamiento activo -> penalización de producción y riesgo alto
  - Con alertas pendientes -> escalado del riesgo

La docstring de predictions_service.py declara que las predicciones son
heurísticas aritméticas, no modelos ML. Estos tests verifican que esa
forma se mantiene estable para que el frontend pueda renderizarla.
"""
from __future__ import annotations

import uuid
from datetime import date

import pytest
from sqlalchemy import select

from app.models.tools4milk import (
    Alerta,
    Animal,
    Lactacion,
    NivelAlerta,
    TratamientoActivo,
)
from app.services import predictions_service


def _make_animal(db, crotal: str = "TEST-PRED-001", estado: str = "produccion"):
    from app.models.tools4milk import Animal

    animal = Animal(
        id=uuid.uuid4(),
        crotal_oficial=crotal,
        nombre="Test Vaca",
        sexo="hembra",
        fecha_nacimiento=date(2021, 1, 1),
        raza="frisona",
        estado=estado,
        estado_reproductivo="lactante",
        fecha_entrada=date(2021, 1, 1),
    )
    db.add(animal)
    db.flush()
    return animal


def _make_lactation(db, animal_id: uuid.UUID, produccion_total_kg: float = 9000.0):
    lactation = Lactacion(
        id=uuid.uuid4(),
        animal_id=animal_id,
        numero=1,
        fecha_parto=date.today(),
        fecha_secado=None,
        produccion_total_kg=produccion_total_kg,
    )
    db.add(lactation)
    db.flush()
    return lactation


class TestComputePrediction:
    """Verifica el contrato del payload devuelto por compute_prediction."""

    def test_sin_lactacion_confianza_degradada(self, db):
        """Sin lactancia activa, la confianza cae al rango 0.4-0.5."""
        animal = _make_animal(db)
        db.commit()

        result = predictions_service.compute_prediction(db, animal)

        assert "produccion" in result
        prod = result["produccion"]
        assert result["method"] == "heuristic_arithmetic"
        assert result["validated"] is False
        assert prod["dias_prediccion"] == 7
        # Sin producción base, la serie es de ceros.
        assert all(value == 0 for value in prod["series_diaria"])
        assert prod["tendencia"] == "estable"

    def test_con_lactacion_sin_ruido(self, db):
        """Con lactancia activa y sin penalizaciones, confianza estándar."""
        animal = _make_animal(db)
        _make_lactation(db, animal.id, produccion_total_kg=9000.0)
        db.commit()

        result = predictions_service.compute_prediction(db, animal)
        prod = result["produccion"]

        # 9000 / 305 ≈ 29.5 L/día base.
        assert 28.0 <= prod["produccion_promedio_predicha"] <= 31.0
        assert result["limitations"]
        # Riesgo bajo sin alertas ni tratamientos.
        assert result["riesgo_sanitario"]["riesgo_promedio"] == "bajo"

        # Composición es placeholder -> 0.
        assert result["composicion"]["grasa"]["prediccion"] == 0
        assert result["composicion"]["proteina"]["prediccion"] == 0

    def test_tratamiento_activo_aplica_penalizacion(self, db):
        """Con tratamiento activo, la producción cae ~8% y el riesgo sube a alto."""
        animal = _make_animal(db)
        _make_lactation(db, animal.id, produccion_total_kg=9000.0)
        db.add(
            TratamientoActivo(
                id=uuid.uuid4(),
                animal_id=animal.id,
                farmaco="Antibiótico test",
                dias_tratamiento=5,
                fecha_inicio=date.today(),
                fecha_fin_prevista=date.today(),
                activo=True,
                checkboxes=[],
            )
        )
        db.commit()

        result = predictions_service.compute_prediction(db, animal)
        prod = result["produccion"]

        # 29.5 * 0.92 ≈ 27.1 (8% penalty).
        assert 26.0 <= prod["produccion_promedio_predicha"] <= 28.0
        assert "Tratamiento activo" in result["riesgo_sanitario"]["factores_riesgo"]
        assert result["riesgo_sanitario"]["riesgo_promedio"] == "alto"
        assert prod["tendencia"] == "descenso"

    def test_alertas_pendientes_escalan_riesgo(self, db):
        """Alertas pendientes (sin tratamiento) elevan el riesgo a medio."""
        animal = _make_animal(db)
        _make_lactation(db, animal.id, produccion_total_kg=9000.0)
        for _ in range(2):
            db.add(
                Alerta(
                    id=uuid.uuid4(),
                    animal_id=animal.id,
                    nivel=NivelAlerta.MEDIA,
                    titulo="Alerta test",
                    mensaje="Mensaje test",
                    activa=True,
                    ts_generacion=predictions_service.utc_now(),
                    push_whatsapp=False,
                    pantalla_tv=True,
                    tablet=True,
                )
            )
        db.commit()

        result = predictions_service.compute_prediction(db, animal)
        # 2 alertas -> 2 * 3% = 6% penalty; cae a 6% (cap 12%).
        prod = result["produccion"]
        assert 27.0 <= prod["produccion_promedio_predicha"] <= 28.5
        assert result["riesgo_sanitario"]["riesgo_promedio"] == "medio"
        assert "Alertas pendientes" in result["riesgo_sanitario"]["factores_riesgo"]

    def test_animal_id_se_preserva_en_payload(self, db):
        """El animal_id del input aparece en el payload final (id o crotal)."""
        _make_animal(db, crotal="ES-CROTAL-99")
        db.commit()
        result_animal = db.execute(
            select(Animal).where(Animal.crotal_oficial == "ES-CROTAL-99")
        ).scalar_one()
        result_animal.estado_reproductivo = "confirmada_gestante"
        db.commit()

        result = predictions_service.compute_prediction(db, result_animal)
        assert result["animal_id"] == str(result_animal.id)

    def test_get_animal_or_none_acepta_uuid_o_crotal(self, db):
        """get_animal_or_none resuelve por UUID o por crotal_oficial."""
        animal = _make_animal(db, crotal="ES-DOBLE-LOOKUP")
        db.commit()
        by_uuid = predictions_service.get_animal_or_none(db, str(animal.id))
        by_crotal = predictions_service.get_animal_or_none(db, "ES-DOBLE-LOOKUP")
        assert by_uuid is not None
        assert by_crotal is not None
        assert by_uuid.id == by_crotal.id

    def test_get_animal_or_none_devuelve_none_si_no_existe(self, db):
        """ID desconocido -> None (no excepción)."""
        result = predictions_service.get_animal_or_none(db, "no-existe-12345")
        assert result is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
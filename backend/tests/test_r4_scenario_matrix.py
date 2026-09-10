"""Matriz determinista R4-5 de escenarios sintéticos (Release 4 DSS).

Semilla fijada y documentada: profile=small, seed=20260910,
simulation_time=2026-09-10T12:00:00+00:00. Los cinco escenarios mínimos
(normal, delayed_tasks, health_alert, degraded_quality, incomplete_data) se
generan con el generador canónico (sin datos ad hoc) y se verifica su
huella diferencial: estados de tareas, severidad de alertas/incidencias,
tendencia de calidad (SCC/producción), predicción degradada y reporte DQ.

Toda fila conserva provenance synthetic/generated; la ausencia de datos
(incomplete_data) se reporta como error DQ honesto, nunca como cero.
"""

from __future__ import annotations

from statistics import mean

import pytest

from app.synthetic_data import (
    GENERATOR_VERSION,
    SOURCE,
    GenerationRequest,
    dataset_digest,
    generate_dataset,
    logical_dataset,
    quality_report,
)

SEED = 20260910
PROFILE = "small"
SIMULATION_TIME = "2026-09-10T12:00:00+00:00"
MATRIX = ["normal", "delayed_tasks", "health_alert", "degraded_quality", "incomplete_data"]


def _request(scenario: str) -> GenerationRequest:
    return GenerationRequest(
        profile=PROFILE,
        seed=SEED,
        scenario=scenario,
        simulation_time=SIMULATION_TIME,
        generated_at=SIMULATION_TIME,
    )


def _animal0_readings(dataset: dict) -> list[dict]:
    animal0 = dataset["animals"][0]["id"]
    rows = [r for r in dataset["milk_readings"] if r["animal_id"] == animal0]
    return sorted(rows, key=lambda r: r["timestamp"])


@pytest.mark.unit
class TestR4ScenarioMatrix:
    @pytest.mark.parametrize("scenario", MATRIX)
    def test_matriz_es_reproducible_y_con_provenance(self, scenario: str) -> None:
        first = generate_dataset(_request(scenario))
        second = generate_dataset(_request(scenario))
        assert dataset_digest(first) == dataset_digest(second)
        assert logical_dataset(first) == logical_dataset(second)
        assert first["manifest"]["scenario_id"] == scenario
        assert first["manifest"]["random_seed"] == SEED
        assert first["manifest"]["generator_version"] == GENERATOR_VERSION
        for kind, rows in first.items():
            if not isinstance(rows, list):
                continue
            for row in rows:
                assert row["provenance"]["source"] == SOURCE
                assert row["provenance"]["scenario_id"] == scenario
                assert row["provenance"]["random_seed"] == SEED

    def test_normal_es_linea_base(self) -> None:
        dataset = generate_dataset(_request("normal"))
        assert {t["status"] for t in dataset["tasks"]} == {"pendiente"}
        assert dataset["alerts"][0]["level"] == "media"
        assert dataset["incidents"][0]["severity"] == "baja"
        assert dataset["incidents"][0]["animal_id"] is None
        assert quality_report(dataset)["ok"]

    def test_delayed_tasks_marca_retrasadas(self) -> None:
        dataset = generate_dataset(_request("delayed_tasks"))
        assert {t["status"] for t in dataset["tasks"]} == {"retrasada"}
        # El resto de la huella no cambia respecto a normal.
        assert dataset["alerts"][0]["level"] == "media"
        assert quality_report(dataset)["ok"]

    def test_health_alert_eleva_scc_y_liga_incidente(self) -> None:
        dataset = generate_dataset(_request("health_alert"))
        readings = _animal0_readings(dataset)
        first_week = mean(r["scc"] for r in readings[:7])
        last_week = mean(r["scc"] for r in readings[-7:])
        assert last_week > first_week + 100000
        assert dataset["alerts"][0]["level"] == "alta"
        assert dataset["incidents"][0]["severity"] == "alta"
        assert dataset["incidents"][0]["animal_id"] == dataset["animals"][0]["id"]
        assert quality_report(dataset)["ok"]

    def test_degraded_quality_cae_produccion_y_prediccion(self) -> None:
        dataset = generate_dataset(_request("degraded_quality"))
        readings = _animal0_readings(dataset)
        first_week = mean(r["production_kg"] for r in readings[:7])
        last_week = mean(r["production_kg"] for r in readings[-7:])
        assert last_week < first_week * 0.9
        assert dataset["predictions"][0]["value"] == 18.0
        assert dataset["alerts"][0]["level"] == "alta"
        assert quality_report(dataset)["ok"]

    def test_incomplete_data_es_dq_honesto_no_cero(self) -> None:
        dataset = generate_dataset(_request("incomplete_data"))
        assert dataset["animals"][0]["zone_id"] is None
        assert dataset["weather"][0]["temperature_c"] is None
        report = quality_report(dataset)
        assert not report["ok"]
        assert "animal missing required zone" in report["errors"]
        assert "weather missing required temperature" in report["errors"]

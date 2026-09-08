"""Pruebas del contrato puro del generador sintético Release 1."""
from __future__ import annotations

from copy import deepcopy

import pytest

from app.synthetic_data import (
    GenerationRequest,
    SCENARIOS,
    dataset_digest,
    generate_dataset,
    logical_dataset,
    quality_report,
)


@pytest.mark.unit
class TestSyntheticData:
    def test_same_version_and_seed_reproduce_logical_dataset(self) -> None:
        request = GenerationRequest(profile="small", seed=77, scenario="normal")
        first = generate_dataset(request)
        second = generate_dataset(request)
        assert logical_dataset(first) == logical_dataset(second)
        assert dataset_digest(first) == dataset_digest(second)

    def test_generated_at_does_not_change_logical_data(self) -> None:
        first = generate_dataset(GenerationRequest(generated_at="2026-01-01T00:00:00+00:00"))
        second = generate_dataset(GenerationRequest(generated_at="2026-02-01T00:00:00+00:00"))
        assert logical_dataset(first) == logical_dataset(second)

    def test_profiles_are_separate_and_scale_animals(self) -> None:
        small = generate_dataset(GenerationRequest(profile="small"))
        demo = generate_dataset(GenerationRequest(profile="demo"))
        load = generate_dataset(GenerationRequest(profile="load"))
        assert len(small["animals"]) == 8
        assert len(demo["animals"]) == 200
        assert len(load["animals"]) == 1000
        assert small["dataset_kind"] != demo["dataset_kind"]

    @pytest.mark.parametrize("scenario", sorted(SCENARIOS))
    def test_all_scenarios_are_available_and_traceable(self, scenario: str) -> None:
        dataset = generate_dataset(GenerationRequest(profile="small", scenario=scenario))
        assert dataset["manifest"]["scenario_id"] == scenario
        assert dataset["manifest"]["generator_version"]
        if scenario != "incomplete_data":
            assert quality_report(dataset)["ok"]

    def test_dq_detects_incomplete_referential_data(self) -> None:
        dataset = generate_dataset(GenerationRequest(profile="small", scenario="normal"))
        dataset["tasks"][0]["employee_id"] = "missing"
        report = quality_report(dataset)
        assert not report["ok"]
        assert "task references unknown employee" in report["errors"]

    def test_dq_detects_duplicate_ids(self) -> None:
        dataset = generate_dataset(GenerationRequest(profile="small"))
        dataset["animals"].append(deepcopy(dataset["animals"][0]))
        report = quality_report(dataset)
        assert not report["ok"]
        assert any(error.startswith("duplicate id") for error in report["errors"])

    def test_invalid_request_is_rejected(self) -> None:
        with pytest.raises(ValueError, match="unknown profile"):
            generate_dataset(GenerationRequest(profile="real"))
        with pytest.raises(ValueError, match="unknown scenario"):
            generate_dataset(GenerationRequest(scenario="real"))

"""Generador determinista de datos sintéticos para demos y pruebas.

El módulo no conoce la base de datos: produce un documento JSON portable que
puede cargarse en adaptadores posteriores. Los UUID se derivan de la versión,
seed, escenario y clave lógica; por ello no dependen del reloj ni del proceso.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib
import uuid
from typing import Any, Final

GENERATOR_VERSION: Final = "1.0.0"
SOURCE: Final = "synthetic/generated"
PROFILES: Final = {"small": 8, "demo": 200, "load": 1000}
SCENARIOS: Final = {
    "normal",
    "delayed_tasks",
    "critical_machinery",
    "health_alert",
    "seasonal_variation",
    "degraded_quality",
    "aemet_failure",
    "degraded_connectivity",
    "incomplete_data",
}


@dataclass(frozen=True)
class GenerationRequest:
    profile: str = "demo"
    seed: int = 20260602
    scenario: str = "normal"
    simulation_time: str = "2026-06-01T12:00:00+00:00"
    generated_at: str = "2026-06-01T12:00:00+00:00"

    def validate(self) -> None:
        if self.profile not in PROFILES:
            raise ValueError(f"unknown profile: {self.profile}")
        if self.scenario not in SCENARIOS:
            raise ValueError(f"unknown scenario: {self.scenario}")
        datetime.fromisoformat(self.simulation_time)
        datetime.fromisoformat(self.generated_at)


def _id(request: GenerationRequest, kind: str, key: str) -> str:
    value = f"tools4milk:{GENERATOR_VERSION}:{request.seed}:{request.scenario}:{kind}:{key}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, value))


def _record(request: GenerationRequest, kind: str, key: str, **values: Any) -> dict[str, Any]:
    values["id"] = _id(request, kind, key)
    values["provenance"] = {
        "source": SOURCE,
        "generator_version": GENERATOR_VERSION,
        "scenario_id": request.scenario,
        "random_seed": request.seed,
        "generated_at": request.generated_at,
        "simulation_time": request.simulation_time,
    }
    return values


def generate_dataset(request: GenerationRequest = GenerationRequest()) -> dict[str, Any]:
    """Generate a deterministic logical dataset for one release scenario."""
    request.validate()
    count = PROFILES[request.profile]
    simulation = datetime.fromisoformat(request.simulation_time)
    day = simulation.date()
    zones = [_record(request, "zone", name, code=code, name=name) for code, name in (("barn", "Nave"), ("nursery", "Recría"), ("care", "Enfermería"))]
    employees = [
        _record(request, "employee", str(i), name=f"Persona Sintética {i + 1}", role="operator" if i else "supervisor")
        for i in range(max(3, min(12, count // 15 + 3)))
    ]
    machinery = [_record(request, "machinery", "robot-1", name="Robot de ordeño sintético", status="operativa")]
    if request.scenario == "critical_machinery":
        machinery[0]["status"] = "averiada"
    animals = []
    lactations = []
    for i in range(count):
        animal_id = _id(request, "animal", str(i))
        animals.append(_record(request, "animal", str(i), id=animal_id, tag=f"SYN-{i + 1:05d}", name=f"Animal Sintético {i + 1:05d}", sex="hembra", status="produccion", zone_id=zones[0]["id"]))
        lactations.append(_record(request, "lactation", str(i), animal_id=animal_id, number=1, calving_date=(day - timedelta(days=120 + i % 90)).isoformat(), daily_kg=28.0 + (i % 9) * 0.5))
    shifts = []
    for offset in range(30):
        shift_day = day - timedelta(days=29 - offset)
        for shift, start, end in (("manana", "06:00", "14:00"), ("tarde", "14:00", "22:00")):
            shifts.append(_record(request, "shift", f"{shift_day.isoformat()}-{shift}", date=shift_day.isoformat(), type=shift, start=start, end=end))
    tasks = []
    task_status = "retrasada" if request.scenario == "delayed_tasks" else "pendiente"
    for i in range(max(6, min(40, count // 5))):
        tasks.append(_record(request, "task", str(i), title=f"Tarea sintética {i + 1}", status=task_status, employee_id=employees[i % len(employees)]["id"], zone_id=zones[i % len(zones)]["id"], planned_at=(simulation + timedelta(hours=i)).isoformat()))
    incidents = [_record(request, "incident", "main", title="Incidencia sintética", severity="alta" if request.scenario in {"critical_machinery", "health_alert"} else "baja", status="abierta", machinery_id=machinery[0]["id"] if request.scenario == "critical_machinery" else None, animal_id=animals[0]["id"] if request.scenario == "health_alert" else None)]
    alerts = [_record(request, "alert", "main", title="Alerta sintética", level="alta" if request.scenario in {"critical_machinery", "health_alert", "degraded_quality"} else "media", animal_id=animals[0]["id"])]
    weather = []
    for offset in range(30):
        timestamp = simulation - timedelta(days=29 - offset)
        temperature = 8.0 + (offset % 10)
        if request.scenario == "seasonal_variation":
            temperature += 10.0
        weather.append(_record(request, "weather", timestamp.isoformat(), timestamp=timestamp.isoformat(), station_id="synthetic_station", temperature_c=temperature, humidity_pct=70.0, source=SOURCE))
    predictions = [_record(request, "prediction", "milk-next-day", metric="milk_next_day_kg", value=28.0 + (count % 7), validated=False, method="heuristic_arithmetic", limitation="simulation only")]
    if request.scenario == "degraded_quality":
        predictions[0]["value"] = 18.0
    dataset = {
        "contract_version": "1.0",
        "dataset_kind": "synthetic_demo" if request.profile == "demo" else f"synthetic_{request.profile}",
        "manifest": {
            "generator_version": GENERATOR_VERSION,
            "scenario_id": request.scenario,
            "random_seed": request.seed,
            "generated_at": request.generated_at,
            "simulation_time": request.simulation_time,
            "profile": request.profile,
            "assumptions": ["identidades ficticias", "distribuciones ilustrativas", "sin claims productivos ni validación científica"],
        },
        "zones": zones, "employees": employees, "machinery": machinery, "animals": animals,
        "lactations": lactations, "shifts": shifts, "tasks": tasks, "incidents": incidents,
        "alerts": alerts, "weather": weather, "predictions": predictions,
    }
    if request.scenario == "incomplete_data":
        dataset["animals"][0]["zone_id"] = None
        dataset["weather"][0]["temperature_c"] = None
    return dataset


def quality_report(dataset: dict[str, Any]) -> dict[str, Any]:
    """Run cheap, provider-independent integrity and data-quality checks."""
    errors: list[str] = []
    manifest = dataset.get("manifest", {})
    required_manifest = {"generator_version", "scenario_id", "random_seed", "generated_at", "simulation_time"}
    errors.extend(f"manifest missing {key}" for key in required_manifest - manifest.keys())
    ids: set[str] = set()
    for kind, rows in dataset.items():
        if not isinstance(rows, list):
            continue
        for row in rows:
            row_id = row.get("id")
            if row_id and row_id in ids:
                errors.append(f"duplicate id {row_id}")
            if row_id:
                ids.add(row_id)
            if row.get("provenance", {}).get("source") != SOURCE:
                errors.append(f"{kind} missing synthetic provenance")
    zone_ids = {row["id"] for row in dataset.get("zones", [])}
    employee_ids = {row["id"] for row in dataset.get("employees", [])}
    animal_ids = {row["id"] for row in dataset.get("animals", [])}
    for row in dataset.get("animals", []):
        if row.get("zone_id") is None:
            errors.append("animal missing required zone")
        elif row["zone_id"] not in zone_ids:
            errors.append("animal references unknown zone")
    for row in dataset.get("tasks", []):
        if row.get("employee_id") not in employee_ids:
            errors.append("task references unknown employee")
        if row.get("zone_id") not in zone_ids:
            errors.append("task references unknown zone")
    for row in dataset.get("lactations", []):
        if row.get("animal_id") not in animal_ids:
            errors.append("lactation references unknown animal")
        if not 0 <= row.get("daily_kg", -1) <= 100:
            errors.append("lactation daily_kg outside range")
    for row in dataset.get("alerts", []):
        if row.get("animal_id") not in animal_ids:
            errors.append("alert references unknown animal")
    for row in dataset.get("weather", []):
        if row.get("temperature_c") is None:
            errors.append("weather missing required temperature")
    return {"ok": not errors, "errors": errors, "checks": ["provenance", "uniqueness", "referential_integrity", "ranges", "manifest"]}


def logical_dataset(dataset: dict[str, Any]) -> dict[str, Any]:
    """Return data suitable for reproducibility comparisons.

    ``generated_at`` is operational metadata and is deliberately excluded from
    each record's provenance; simulation timestamps and all domain values stay.
    """
    def canonical(value: Any) -> Any:
        if isinstance(value, dict):
            return {key: canonical(item) for key, item in value.items() if key != "generated_at"}
        if isinstance(value, list):
            return [canonical(item) for item in value]
        return value

    return canonical({key: value for key, value in dataset.items() if key != "manifest"})


def dataset_digest(dataset: dict[str, Any]) -> str:
    payload = repr(logical_dataset(dataset)).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()

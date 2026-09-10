"""Tests del endpoint de tendencia temporal por animal (Release 4 DSS).

Cubre ``GET /api/v1/animals/{animal_id}/readings``:
autenticación/RBAC, 404, validación 422, orden ascendente estable,
filtros de rango (days/limit), estado vacío («Sin datos suficientes» en UI)
y provenance sintética. Además verifica que los escenarios sintéticos
existentes (demo, health_alert, degraded_quality) siguen generando datasets
válidos y que el seed legado identifica sus datos como sintéticos.
"""

from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
import uuid
from sqlalchemy import select

from app.models.usuario import Usuario
from app.models.tools4milk import Animal, Lactacion, LecturaRobotOrdeno, Maquinaria
from app.security import hash_password
from app.synthetic_data import GenerationRequest, generate_dataset, quality_report
from app.time_utils import utc_now

BACKEND_DIR = Path(__file__).resolve().parents[1]
SEED_SCRIPT = BACKEND_DIR / "scripts" / "seed_realistic_data.py"


def _make_animal(db, crotal="SYN-TREND-001"):
    animal = Animal(
        id=uuid.uuid4(),
        crotal_oficial=crotal,
        nombre="Animal Sintético Tendencia",
        sexo="hembra",
        fecha_nacimiento=date(2021, 1, 1),
        raza="frisona",
        estado="produccion",
        estado_reproductivo="vacia",
        fecha_entrada=date(2021, 1, 1),
    )
    db.add(animal)
    db.commit()
    db.refresh(animal)
    return animal


def _make_robot(db):
    robot = Maquinaria(
        id=uuid.uuid4(),
        nombre="Robot sintético test",
        tipo="robot_ordeno",
        activa=True,
        estado="operativa",
    )
    db.add(robot)
    db.commit()
    db.refresh(robot)
    return robot


def _seed_readings(db, animal, robot, days=5, base_kg=28.0, base_scc=120000):
    now = utc_now()
    # La PK es (ts, robot_id): escalonar segundos por animal (derivado estable
    # del UUID) para que dos animales con el mismo robot no colisionen.
    stagger_s = int(str(animal.id).replace("-", "")[:8], 16) % 3000 + 5
    for d in range(days):
        db.add(
            LecturaRobotOrdeno(
                ts=now - timedelta(days=days - 1 - d) + timedelta(seconds=stagger_s),
                robot_id=robot.id,
                animal_id=animal.id,
                lactacion_id=None,
                produccion_kg=Decimal(str(base_kg + d * 0.5)),
                conductividad=Decimal("5.50"),
                flujo_max=Decimal("3.20"),
                scc=base_scc + d * 1000,
                duracion_min=Decimal("7.0"),
                intentos_fallidos=0,
                alerta_robot=False,
            )
        )
    db.commit()


def _headers_for_role(client, db, role: str) -> dict[str, str]:
    username = f"quality.{role}"
    user = db.scalar(select(Usuario).where(Usuario.username == username))
    if user is None:
        user = Usuario(
            id=uuid.uuid4(),
            username=username,
            email=f"{username}@tools4milk.local",
            hashed_password=hash_password("testpass123"),
            role=role,
            activo=True,
            debe_cambiar_contrasena=False,
            fecha_creacion=utc_now(),
        )
        db.add(user)
    else:
        user.role = role
        user.activo = True
        user.hashed_password = hash_password("testpass123")
    db.commit()
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "testpass123"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']['access_token']}"}


class TestAnimalReadingsAuth:
    def test_sin_auth_devuelve_401(self, client, db):
        animal = _make_animal(db)
        assert client.get(f"/api/v1/animals/{animal.id}/readings").status_code == 401

    @pytest.mark.parametrize("role", ["admin", "veterinario", "operario", "alimentacion"])
    def test_roles_de_lectura_calidad_pueden_consultar(self, client, db, role):
        animal = _make_animal(db, crotal=f"SYN-TREND-RBAC-{role}")
        response = client.get(
            f"/api/v1/animals/{animal.id}/readings",
            headers=_headers_for_role(client, db, role),
        )
        assert response.status_code == 200

    def test_animal_inexistente_devuelve_404(self, client, auth_headers):
        response = client.get(f"/api/v1/animals/{uuid.uuid4()}/readings", headers=auth_headers)
        assert response.status_code == 404
        assert response.json()["detail"] == "Animal no encontrado"

    def test_animal_id_invalido_devuelve_404(self, client, auth_headers):
        response = client.get("/api/v1/animals/no-es-uuid/readings", headers=auth_headers)
        assert response.status_code == 404


class TestAnimalReadingsValidation:
    @pytest.mark.parametrize("params", [{"days": 0}, {"days": 91}, {"limit": 0}, {"limit": 181}])
    def test_rango_invalido_devuelve_422(self, client, db, auth_headers, params):
        animal = _make_animal(db)
        response = client.get(f"/api/v1/animals/{animal.id}/readings", headers=auth_headers, params=params)
        assert response.status_code == 422


class TestAnimalReadingsSeries:
    def test_serie_ordenada_con_provenance_sintetica(self, client, db, auth_headers):
        animal = _make_animal(db)
        robot = _make_robot(db)
        _seed_readings(db, animal, robot, days=5)
        response = client.get(f"/api/v1/animals/{animal.id}/readings", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["animal_id"] == str(animal.id)
        assert body["count"] == 5
        assert body["provenance"]["source"] == "generated"
        assert body["provenance"]["synthetic"] is True
        readings = body["readings"]
        assert len(readings) == 5
        fechas = [r["fecha"] for r in readings]
        assert fechas == sorted(fechas), "orden ascendente estable por fecha"
        assert readings[0]["produccion_kg"] == pytest.approx(28.0)
        assert readings[-1]["produccion_kg"] == pytest.approx(30.0)
        assert readings[0]["scc"] == 120000
        assert all(r["ts"] for r in readings)

    def test_filtro_days_acota_la_ventana(self, client, db, auth_headers):
        animal = _make_animal(db, crotal="SYN-TREND-DAYS")
        robot = _make_robot(db)
        _seed_readings(db, animal, robot, days=10)
        full = client.get(
            f"/api/v1/animals/{animal.id}/readings", headers=auth_headers, params={"days": 90, "limit": 180}
        ).json()
        assert full["count"] == 10
        filtered = client.get(
            f"/api/v1/animals/{animal.id}/readings", headers=auth_headers, params={"days": 2, "limit": 180}
        ).json()
        assert 1 <= filtered["count"] < full["count"], "la ventana days acota sin fabricar puntos"

    def test_filtro_limit_acota_la_respuesta(self, client, db, auth_headers):
        animal = _make_animal(db, crotal="SYN-TREND-LIMIT")
        robot = _make_robot(db)
        _seed_readings(db, animal, robot, days=10)
        response = client.get(
            f"/api/v1/animals/{animal.id}/readings", headers=auth_headers, params={"days": 90, "limit": 4}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 4
        assert len(body["readings"]) == 4
        assert [reading["produccion_kg"] for reading in body["readings"]] == pytest.approx([31.0, 31.5, 32.0, 32.5])

    def test_sin_lecturas_devuelve_vacio_no_fabrica_puntos(self, client, db, auth_headers):
        """Sin filas en BD la respuesta es vacía: la UI muestra «Sin datos suficientes»."""
        animal = _make_animal(db, crotal="SYN-TREND-EMPTY")
        response = client.get(f"/api/v1/animals/{animal.id}/readings", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 0
        assert body["readings"] == []

    def test_lecturas_de_otro_animal_no_se_mezclan(self, client, db, auth_headers):
        animal_a = _make_animal(db, crotal="SYN-TREND-A")
        animal_b = _make_animal(db, crotal="SYN-TREND-B")
        robot = _make_robot(db)
        _seed_readings(db, animal_a, robot, days=3, base_scc=100000)
        _seed_readings(db, animal_b, robot, days=3, base_scc=400000)
        body = client.get(f"/api/v1/animals/{animal_b.id}/readings", headers=auth_headers).json()
        assert body["count"] == 3
        assert {r["scc"] for r in body["readings"]} == {400000, 401000, 402000}


class TestExistingSyntheticScenarios:
    @pytest.mark.parametrize(
        ("profile", "scenario"),
        [("demo", "normal"), ("demo", "health_alert"), ("demo", "degraded_quality")],
        ids=["demo", "health_alert", "degraded_quality"],
    )
    def test_escenarios_existentes_siguen_validos(self, profile, scenario):
        dataset = generate_dataset(GenerationRequest(profile=profile, scenario=scenario))
        report = quality_report(dataset)
        assert report["ok"], f"escenario {scenario}: {report['errors']}"
        assert len(dataset["milk_readings"]) == len(dataset["animals"]) * 30
        assert all(row["provenance"]["source"] == "synthetic/generated" for row in dataset["milk_readings"])

    def test_escenarios_calidad_modifican_la_serie_sin_aleatoriedad(self):
        normal = generate_dataset(GenerationRequest(profile="small", seed=17, scenario="normal"))
        health = generate_dataset(GenerationRequest(profile="small", seed=17, scenario="health_alert"))
        degraded = generate_dataset(GenerationRequest(profile="small", seed=17, scenario="degraded_quality"))
        assert max(row["scc"] for row in health["milk_readings"][:30]) > max(
            row["scc"] for row in normal["milk_readings"][:30]
        )
        assert degraded["milk_readings"][-1]["production_kg"] < normal["milk_readings"][-1]["production_kg"]


class TestSeedProvenance:
    def test_seed_legado_no_niega_provenance_demo(self):
        """Deuda de provenance R4: el seed debe identificarse como sintético/demo."""
        text = SEED_SCRIPT.read_text(encoding="utf-8")
        assert "NO etiquetados como" not in text
        assert "synthetic/generated" in text
        assert "fictici" in text.lower() or "sintétic" in text.lower()

    def test_seed_siembra_serie_robot_cuando_hay_robots(self, tmp_path):
        """El seed siembra lecturas diarias por lactación activa si hay robots (idempotente)."""
        import os
        import subprocess
        import sys
        import uuid as uuid_mod
        from sqlalchemy import create_engine, func, select
        from sqlalchemy.orm import sessionmaker

        db_path = tmp_path / "seed_robot.db"
        db_url = f"sqlite:///{db_path}"
        env = {**os.environ, "DATABASE_URL": db_url, "ENVIRONMENT": "development"}

        def run_seed():
            result = subprocess.run(
                [sys.executable, str(SEED_SCRIPT)], cwd=str(BACKEND_DIR), env=env,
                capture_output=True, text=True, timeout=180,
            )
            assert result.returncode == 0, f"Seed falló: {result.stderr}\n{result.stdout}"
            return result

        run_seed()
        engine = create_engine(db_url)
        Session = sessionmaker(bind=engine)
        with Session() as db:
            lactations = db.scalar(select(func.count()).select_from(Lactacion))
            assert lactations and lactations > 0, "el seed crea lactaciones"
            # La migración baseline no corre en SQLite: registramos un robot sintético.
            db.add(Maquinaria(
                id=uuid_mod.uuid4(), nombre="VMS sintético", tipo="robot_ordeno",
                activa=True, estado="operativa",
            ))
            db.commit()
        run_seed()
        with Session() as db:
            readings = db.scalar(select(func.count()).select_from(LecturaRobotOrdeno))
            assert readings and readings >= lactations, "una serie diaria por lactación activa"
        run_seed()
        with Session() as db:
            again = db.scalar(select(func.count()).select_from(LecturaRobotOrdeno))
            assert again == readings, "re-ejecutar no duplica lecturas"

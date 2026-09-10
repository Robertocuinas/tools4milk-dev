"""Tests de GET /api/v1/weather/correlation/impact (Release 4 DSS).

Cubre: autenticación/RBAC de lectura (sin ampliar privilegios), estado vacío
(``insufficient_data`` sin inventar resultados), cálculo determinista sobre
datos sintéticos (Pearson documentado, r en [-1, 1], provenance sintética),
validación 422 y RBAC de predicciones granulares (operario 403).
"""

from datetime import date, timedelta
from decimal import Decimal

import uuid
from sqlalchemy import select

from app.models.tools4milk import (
    Animal,
    Lactacion,
    LecturaMeteo,
    LecturaRobotOrdeno,
    Maquinaria,
)
from app.models.usuario import Usuario
from app.security import hash_password
from app.services import weather_correlation_service
from app.time_utils import utc_now


def _headers_for_role(client, db, role: str) -> dict[str, str]:
    username = f"corr.{role}"
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


def _seed_paired_days(db, days: int = 8):
    """Siembra días emparejados meteo + producción (determinista, sintético)."""
    now = utc_now()
    animal = Animal(
        id=uuid.uuid4(),
        crotal_oficial="SYN-CORR-001",
        nombre="Animal Sintético Correlación",
        sexo="hembra",
        fecha_nacimiento=date(2021, 1, 1),
        raza="frisona",
        estado="produccion",
        estado_reproductivo="vacia",
        fecha_entrada=date(2021, 1, 1),
    )
    db.add(animal)
    robot = Maquinaria(
        id=uuid.uuid4(),
        nombre="Robot sintético correlación",
        tipo="robot_ordeno",
        activa=True,
        estado="operativa",
    )
    db.add(robot)
    db.commit()
    db.refresh(animal)
    db.refresh(robot)
    stagger_s = int(str(animal.id).replace("-", "")[:8], 16) % 3000 + 5
    for d in range(days):
        ts = now - timedelta(days=days - 1 - d)
        # Temperatura creciente y producción creciente → r positivo esperado.
        db.add(
            LecturaMeteo(
                ts=ts,
                estacion_id="SYN",
                temperatura_c=Decimal(str(15.0 + d)),
                humedad_relativa=Decimal(str(60.0 + d)),
                precipitacion_mm=Decimal("0.0"),
                prob_precipitacion_pct=Decimal("10.0"),
                viento_km_h=Decimal("5.0"),
                fuente="generated",
            )
        )
        db.add(
            LecturaRobotOrdeno(
                ts=ts + timedelta(seconds=stagger_s),
                robot_id=robot.id,
                animal_id=animal.id,
                lactacion_id=None,
                produccion_kg=Decimal(str(28.0 + d * 0.4)),
                conductividad=Decimal("5.50"),
                flujo_max=Decimal("3.20"),
                scc=120000,
                duracion_min=Decimal("7.0"),
                intentos_fallidos=0,
                alerta_robot=False,
            )
        )
    db.add(
        Lactacion(
            id=uuid.uuid4(),
            animal_id=animal.id,
            numero=1,
            fecha_parto=date(2025, 1, 1),
            fecha_secado=None,
            produccion_total_kg=9000,
        )
    )
    db.commit()
    return animal


class TestCorrelationAuth:
    def test_sin_auth_devuelve_401(self, client):
        assert client.get("/api/v1/weather/correlation/impact").status_code == 401

    def test_roles_de_lectura_existentes_pueden_consultar(self, client, db):
        for role in ["admin", "veterinario", "operario", "alimentacion"]:
            response = client.get(
                "/api/v1/weather/correlation/impact",
                headers=_headers_for_role(client, db, role),
            )
            assert response.status_code == 200, role


class TestCorrelationEmpty:
    def test_sin_datos_devuelve_insufficient_sin_inventar(self, client, auth_headers):
        response = client.get("/api/v1/weather/correlation/impact", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "insufficient_data"
        assert body["asociaciones"] == []
        assert body["impactos_predichos"] == []
        assert body["sample_size"] < body["min_sample_size"]
        assert body["min_sample_size"] == 5
        assert body["metodo"] == "pearson_descriptivo"
        assert "Σ((x - mx)(y - my))" in body["formula"]
        assert body["aviso"] == (
            "Asociación descriptiva sobre datos sintéticos; no implica causalidad "
            "ni validez predictiva, clínica o productiva"
        )
        assert body["provenance"]["source"] == "generated"
        assert body["provenance"]["synthetic"] is True


class TestCorrelationComputed:
    def test_calculo_determinista_con_datos_sinteticos(self, client, db, auth_headers):
        animal = _seed_paired_days(db, days=8)
        assert animal is not None
        first = client.get(
            "/api/v1/weather/correlation/impact", headers=auth_headers
        ).json()
        second = client.get(
            "/api/v1/weather/correlation/impact", headers=auth_headers
        ).json()
        assert first == second, "determinista: misma BD → misma respuesta"
        assert first["status"] == "sufficient"
        assert first["sample_size"] >= 5
        assert len(first["asociaciones"]) == 2
        for assoc in first["asociaciones"]:
            assert assoc["n"] >= 5
            assert assoc["pearson_r"] is not None
            assert -1.0 <= assoc["pearson_r"] <= 1.0
            assert "sin implicar causalidad" in assoc["interpretacion"]
            assert assoc["variable_productiva"] == "produccion_kg_media_diaria"
        temp_assoc = next(
            a
            for a in first["asociaciones"]
            if a["variable_meteo"] == "temperatura_c_media_diaria"
        )
        assert temp_assoc["pearson_r"] > 0.9, "series crecientes → r alto positivo"
        assert first["impactos_predichos"] == []
        assert first["provenance"]["synthetic"] is True

    def test_no_hay_lenguaje_causal_en_respuesta(self, client, db, auth_headers):
        _seed_paired_days(db, days=8)
        import json as _json
        import re as _re

        body = client.get("/api/v1/weather/correlation/impact", headers=auth_headers).json()
        text = _json.dumps(body, ensure_ascii=False).lower()
        # La palabra "causalidad" solo puede aparecer negada en el aviso.
        assert "no implica causalidad" in text
        for banned in [
            r"\bcausa\b",
            r"\bcausan\b",
            r"\bprovoca\b",
            r"\bpredice un impacto\b",
            r"\brecomendamos\b",
            r"\bdebe aplicar\b",
        ]:
            assert _re.search(banned, text) is None, banned

    def test_servicio_puro_es_determinista(self, client, db):
        _seed_paired_days(db, days=8)
        r1 = weather_correlation_service.compute_correlation(db)
        r2 = weather_correlation_service.compute_correlation(db)
        assert r1 == r2


class TestCorrelationValidation:
    def test_parametros_fuera_de_rango_devuelven_422(self, client, auth_headers):
        assert (
            client.get(
                "/api/v1/weather/correlation/impact?dias_adelante=0",
                headers=auth_headers,
            ).status_code
            == 422
        )
        assert (
            client.get(
                "/api/v1/weather/correlation/impact?ventana_dias=91",
                headers=auth_headers,
            ).status_code
            == 422
        )


class TestGranularPredictionsRbac:
    def test_operario_no_accede_a_predicciones(self, client, db):
        animal = Animal(
            id=uuid.uuid4(),
            crotal_oficial="SYN-CORR-RBAC",
            nombre="RBAC",
            sexo="hembra",
            fecha_nacimiento=date(2021, 1, 1),
            raza="frisona",
            estado="produccion",
            estado_reproductivo="vacia",
            fecha_entrada=date(2021, 1, 1),
        )
        db.add(animal)
        db.commit()
        headers = _headers_for_role(client, db, "operario")
        for path in (
            f"/api/v1/predictions/{animal.id}",
            f"/api/v1/predictions/production/{animal.id}",
            f"/api/v1/predictions/composition/{animal.id}",
            f"/api/v1/predictions/health-risk/{animal.id}",
        ):
            assert client.get(path, headers=headers).status_code == 403, path

    def test_roles_autorizados_acceden_a_granulares(self, client, db):
        animal = Animal(
            id=uuid.uuid4(),
            crotal_oficial="SYN-CORR-RBAC-OK",
            nombre="RBAC OK",
            sexo="hembra",
            fecha_nacimiento=date(2021, 1, 1),
            raza="frisona",
            estado="produccion",
            estado_reproductivo="vacia",
            fecha_entrada=date(2021, 1, 1),
        )
        db.add(animal)
        db.commit()
        for role in ["admin", "veterinario", "alimentacion"]:
            headers = _headers_for_role(client, db, role)
            for path in (
                f"/api/v1/predictions/{animal.id}",
                f"/api/v1/predictions/production/{animal.id}",
                f"/api/v1/predictions/composition/{animal.id}",
                f"/api/v1/predictions/health-risk/{animal.id}",
            ):
                assert client.get(path, headers=headers).status_code == 200, (role, path)

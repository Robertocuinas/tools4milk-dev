"""R5 P2: contrato de alertas por animal (R5-RF-07) y estadísticas (R5-RF-08).

Datos sintéticos deterministas sembrados por inserción directa; sin
lectura clínica ni causal: ``severidad_promedio`` es una agregación
descriptiva (baja=1, media=2, alta=3) del conjunto filtrado.
"""

import uuid
from datetime import date, timedelta

from app.enums import NivelAlerta
from app.models.tools4milk import Alerta, Animal
from app.time_utils import utc_now


def _make_animal(db, crotal: str) -> Animal:
    animal = Animal(
        id=uuid.uuid4(),
        crotal_oficial=crotal,
        nombre="Animal sintético P2",
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


def _add_alert(
    db,
    animal_id,
    nivel: NivelAlerta,
    ts_generacion=None,
    activa: bool = True,
    ts_resolucion=None,
    titulo: str = "Alerta sintética P2",
) -> Alerta:
    item = Alerta(
        id=uuid.uuid4(),
        nivel=nivel,
        titulo=titulo,
        mensaje="Dato sintético de prueba",
        animal_id=animal_id,
        activa=activa,
        ts_generacion=ts_generacion or utc_now(),
        ts_resolucion=ts_resolucion,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


class TestAnimalAlertsContract:
    """P2-1: 422 si no es UUID, 404 si no existe, 200+vacío solo si existe."""

    def test_invalid_uuid_returns_422(self, client, auth_headers):
        r = client.get("/api/v1/alerts/no-es-un-uuid", headers=auth_headers)
        assert r.status_code == 422

    def test_unknown_uuid_returns_404(self, client, auth_headers):
        r = client.get(f"/api/v1/alerts/{uuid.uuid4()}", headers=auth_headers)
        assert r.status_code == 404

    def test_existing_animal_without_alerts_returns_200_empty(self, client, db, auth_headers):
        animal = _make_animal(db, "P2-EMPTY-001")
        r = client.get(f"/api/v1/alerts/{animal.id}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["animal_id"] == str(animal.id)
        assert data["total"] == 0
        assert data["alertas"] == []
        stats = data["estadisticas"]
        assert stats["total_alertas"] == 0
        assert stats["alertas_ultimos_30_dias"] == 0
        assert stats["pendientes"] == 0
        assert stats["tasa_resolucion_pct"] == 0
        assert stats["severidad_promedio"] is None

    def test_existing_animal_with_alerts_returns_200(self, client, db, auth_headers):
        animal = _make_animal(db, "P2-FULL-001")
        _add_alert(db, animal.id, NivelAlerta.MEDIA)
        _add_alert(db, animal.id, NivelAlerta.ALTA)
        r = client.get(f"/api/v1/alerts/{animal.id}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 2
        assert len(data["alertas"]) == 2
        assert data["estadisticas"]["total_alertas"] == 2

    def test_animal_alerts_require_authentication(self, client, db):
        animal = _make_animal(db, "P2-AUTH-001")
        assert client.get(f"/api/v1/alerts/{animal.id}").status_code == 401
        assert client.get("/api/v1/alerts/no-es-uuid").status_code == 401


class TestAlertsStats:
    """P2-2: estadísticas sobre el conjunto filtrado, antes de paginar."""

    def test_pagination_does_not_change_stats(self, client, db, auth_headers):
        animal = _make_animal(db, "P2-PAGE-001")
        for _ in range(5):
            _add_alert(db, animal.id, NivelAlerta.MEDIA)
        p1 = client.get(
            f"/api/v1/alerts/{animal.id}", params={"skip": 0, "limit": 2}, headers=auth_headers
        ).json()
        p2 = client.get(
            f"/api/v1/alerts/{animal.id}", params={"skip": 2, "limit": 2}, headers=auth_headers
        ).json()
        assert len(p1["alertas"]) == 2
        assert p1["total"] == 5 == p2["total"]
        assert p1["estadisticas"] == p2["estadisticas"]
        assert p1["estadisticas"]["total_alertas"] == 5
        assert p1["estadisticas"]["pendientes"] == 5

    def test_30_day_window(self, client, db, auth_headers):
        animal = _make_animal(db, "P2-WIN-001")
        now = utc_now()
        _add_alert(db, animal.id, NivelAlerta.MEDIA, ts_generacion=now - timedelta(days=1))
        _add_alert(db, animal.id, NivelAlerta.MEDIA, ts_generacion=now - timedelta(days=29))
        _add_alert(db, animal.id, NivelAlerta.MEDIA, ts_generacion=now - timedelta(days=31))
        _add_alert(db, animal.id, NivelAlerta.MEDIA, ts_generacion=now - timedelta(days=60))
        stats = client.get(f"/api/v1/alerts/{animal.id}", headers=auth_headers).json()[
            "estadisticas"
        ]
        assert stats["total_alertas"] == 4
        assert stats["alertas_ultimos_30_dias"] == 2

    def test_pending_resolved_and_rate(self, client, db, auth_headers):
        animal = _make_animal(db, "P2-RATE-001")
        now = utc_now()
        _add_alert(db, animal.id, NivelAlerta.MEDIA)  # pendiente
        _add_alert(db, animal.id, NivelAlerta.MEDIA)  # pendiente
        _add_alert(  # resuelta
            db, animal.id, NivelAlerta.ALTA, activa=False, ts_resolucion=now - timedelta(hours=1)
        )
        _add_alert(db, animal.id, NivelAlerta.BAJA, activa=False, ts_resolucion=None)  # revisada
        stats = client.get(f"/api/v1/alerts/{animal.id}", headers=auth_headers).json()[
            "estadisticas"
        ]
        assert stats["total_alertas"] == 4
        assert stats["pendientes"] == 2
        assert stats["tasa_resolucion_pct"] == 25.0

    def test_empty_global_stats(self, client, auth_headers):
        # BD fresca por test: sin alertas, tasa exactamente 0 y severidad null.
        stats = client.get("/api/v1/alerts", headers=auth_headers).json()["estadisticas"]
        assert stats["total_alertas"] == 0
        assert stats["alertas_ultimos_30_dias"] == 0
        assert stats["pendientes"] == 0
        assert stats["tasa_resolucion_pct"] == 0
        assert stats["severidad_promedio"] is None

    def test_severity_bands(self, client, db, auth_headers):
        low = _make_animal(db, "P2-SEV-LOW")
        for _ in range(3):
            _add_alert(db, low.id, NivelAlerta.BAJA)
        stats = client.get(f"/api/v1/alerts/{low.id}", headers=auth_headers).json()[
            "estadisticas"
        ]
        assert stats["severidad_promedio"] == "baja"

        mid = _make_animal(db, "P2-SEV-MID")
        _add_alert(db, mid.id, NivelAlerta.BAJA)
        _add_alert(db, mid.id, NivelAlerta.ALTA)  # media 2.0 → banda media
        stats = client.get(f"/api/v1/alerts/{mid.id}", headers=auth_headers).json()[
            "estadisticas"
        ]
        assert stats["severidad_promedio"] == "media"

        high = _make_animal(db, "P2-SEV-HIGH")
        for _ in range(2):
            _add_alert(db, high.id, NivelAlerta.ALTA)
        stats = client.get(f"/api/v1/alerts/{high.id}", headers=auth_headers).json()[
            "estadisticas"
        ]
        assert stats["severidad_promedio"] == "alta"
        assert stats["severidad_promedio"] != "critica"

    def test_severity_band_boundaries(self, client, db, auth_headers):
        edge_low = _make_animal(db, "P2-SEV-E1")  # media 1.5 → banda media
        _add_alert(db, edge_low.id, NivelAlerta.BAJA)
        _add_alert(db, edge_low.id, NivelAlerta.MEDIA)
        stats = client.get(f"/api/v1/alerts/{edge_low.id}", headers=auth_headers).json()[
            "estadisticas"
        ]
        assert stats["severidad_promedio"] == "media"

        edge_high = _make_animal(db, "P2-SEV-E2")  # media 2.5 → banda alta
        _add_alert(db, edge_high.id, NivelAlerta.MEDIA)
        _add_alert(db, edge_high.id, NivelAlerta.ALTA)
        stats = client.get(f"/api/v1/alerts/{edge_high.id}", headers=auth_headers).json()[
            "estadisticas"
        ]
        assert stats["severidad_promedio"] == "alta"

    def test_critical_endpoint_stats_are_scoped(self, client, db, auth_headers):
        animal = _make_animal(db, "P2-CRIT-001")
        _add_alert(db, animal.id, NivelAlerta.ALTA)
        _add_alert(db, animal.id, NivelAlerta.ALTA)
        _add_alert(db, animal.id, NivelAlerta.MEDIA)
        data = client.get("/api/v1/alerts/critical", headers=auth_headers).json()
        stats = data["estadisticas"]
        assert stats["total_alertas"] == data["total"] >= 2
        assert stats["total_alertas"] == 2
        assert stats["severidad_promedio"] == "alta"
        assert all(a["severidad"] == "alta" for a in data["alertas"])

    def test_list_filter_stats_are_scoped(self, client, db, auth_headers):
        animal = _make_animal(db, "P2-FILT-001")
        _add_alert(db, animal.id, NivelAlerta.ALTA)
        _add_alert(db, animal.id, NivelAlerta.BAJA)
        data = client.get("/api/v1/alerts", params={"severidad": "alta"}, headers=auth_headers).json()
        assert data["estadisticas"]["total_alertas"] == data["total"] >= 1
        assert data["estadisticas"]["severidad_promedio"] == "alta"

    def test_resolve_updates_stats(self, client, db, auth_headers):
        animal = _make_animal(db, "P2-RES-001")
        created = client.post(
            "/api/v1/alerts",
            json={
                "animal_id": str(animal.id),
                "tipo_alerta": "alerta_p2_resolve",
                "severidad": "media",
                "descripcion": "Alerta sintética P2 para resolver",
            },
            headers=auth_headers,
        )
        assert created.status_code == 201
        alert = created.json()
        resolved = client.patch(
            f"/api/v1/alerts/{alert['id']}",
            json={
                "estado": "resuelta",
                "notas_operario": "Resuelta en test P2",
                "expected_version": alert["version"],
            },
            headers={**auth_headers, "X-Operation-Id": str(uuid.uuid4())},
        )
        assert resolved.status_code == 200
        stats = client.get(f"/api/v1/alerts/{animal.id}", headers=auth_headers).json()[
            "estadisticas"
        ]
        assert stats["total_alertas"] == 1
        assert stats["pendientes"] == 0
        assert stats["tasa_resolucion_pct"] == 100.0


class TestAlertsRbac:
    """RBAC y autenticación actuales se conservan en los tres endpoints."""

    def test_list_and_critical_require_authentication(self, client):
        assert client.get("/api/v1/alerts").status_code == 401
        assert client.get("/api/v1/alerts/critical").status_code == 401

    def test_operario_can_read_alerts(self, client, operario_headers):
        assert client.get("/api/v1/alerts", headers=operario_headers).status_code == 200
        assert client.get("/api/v1/alerts/critical", headers=operario_headers).status_code == 200

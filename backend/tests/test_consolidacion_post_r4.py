"""Consolidacion post-R4: contratos de paginacion SQL (alerts) y honestidad weather.

- Alerts: total/skip/limit coherentes a nivel SQL, orden determinista, vacios.
- Weather: sin hardcode causal; descriptivo honesto con insufficient_data.
"""

import uuid

from app.models.tools4milk import LecturaMeteo
from app.time_utils import utc_now


def _mk_alert(animal_id: str, idx: int) -> dict:
    return {
        "animal_id": animal_id,
        "tipo_alerta": f"alerta_consolidacion_{idx}",
        "severidad": "media",
        "descripcion": f"Alerta sintetica de consolidacion {idx}",
    }


class TestAlertsPaginationSQL:
    def test_list_pagination_contract(self, client, auth_headers):
        animal = str(uuid.uuid4())
        for i in range(5):
            r = client.post("/api/v1/alerts", json=_mk_alert(animal, i), headers=auth_headers)
            assert r.status_code == 201

        page1 = client.get("/api/v1/alerts", params={"skip": 0, "limit": 2}, headers=auth_headers)
        assert page1.status_code == 200
        d1 = page1.json()
        assert d1["skip"] == 0 and d1["limit"] == 2
        assert d1["total"] >= 5
        assert len(d1["alertas"]) == 2
        assert d1["estadisticas"]["total_alertas"] == d1["total"]

        page2 = client.get("/api/v1/alerts", params={"skip": 2, "limit": 2}, headers=auth_headers)
        assert page2.status_code == 200
        d2 = page2.json()
        assert d2["total"] == d1["total"]
        assert len(d2["alertas"]) == 2
        ids1 = {a["id"] for a in d1["alertas"]}
        ids2 = {a["id"] for a in d2["alertas"]}
        assert not ids1 & ids2, "las paginas SQL no deben solaparse"

    def test_list_empty_page_keeps_total(self, client, auth_headers):
        base = client.get("/api/v1/alerts", params={"skip": 0, "limit": 1}, headers=auth_headers).json()
        total = base["total"]
        empty = client.get(
            "/api/v1/alerts", params={"skip": total + 50, "limit": 10}, headers=auth_headers
        )
        assert empty.status_code == 200
        data = empty.json()
        assert data["alertas"] == []
        assert data["total"] == total
        assert data["skip"] == total + 50

    def test_list_validates_pagination(self, client, auth_headers):
        assert client.get("/api/v1/alerts", params={"skip": -1}, headers=auth_headers).status_code == 422
        assert client.get("/api/v1/alerts", params={"limit": 0}, headers=auth_headers).status_code == 422

    def test_by_animal_pagination(self, client, auth_headers):
        animal = str(uuid.uuid4())
        for i in range(3):
            r = client.post("/api/v1/alerts", json=_mk_alert(animal, i), headers=auth_headers)
            assert r.status_code == 201

        p1 = client.get(f"/api/v1/alerts/{animal}", params={"skip": 0, "limit": 2}, headers=auth_headers)
        assert p1.status_code == 200
        d1 = p1.json()
        assert d1["animal_id"] == animal
        assert d1["total"] >= 3
        assert len(d1["alertas"]) == 2

        p2 = client.get(f"/api/v1/alerts/{animal}", params={"skip": 2, "limit": 2}, headers=auth_headers)
        assert p2.status_code == 200
        d2 = p2.json()
        assert d2["total"] == d1["total"]
        assert len(d2["alertas"]) >= 1

    def test_critical_pagination(self, client, auth_headers):
        r = client.get("/api/v1/alerts/critical", params={"skip": 0, "limit": 2}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["skip"] == 0 and data["limit"] == 2
        assert data["total"] >= 0
        assert len(data["alertas"]) <= 2


class TestWeatherHonesty:
    def _seed_lectura(self, db):
        db.add(
            LecturaMeteo(
                ts=utc_now().replace(tzinfo=None),
                estacion_id="consolidacion-test",
                temperatura_c=18.5,
                humedad_relativa=65,
                fuente="generated",
            )
        )
        db.commit()

    def test_current_no_causal_hardcode(self, client, db, auth_headers):
        self._seed_lectura(db)
        r = client.get("/api/v1/weather/current", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["ubicacion"] == "Villalba, Lugo"
        # Sin hardcode causal: impacto siempre None y lectura marcada descriptiva.
        assert data.get("impacto_productivo") is None
        assert data.get("suficiencia") == "insufficient_data"
        assert data.get("aviso")
        assert "descriptiva" in (data.get("descripcion") or "").lower()

    def test_current_without_rows_is_honest(self, client, db, auth_headers):
        for row in db.query(LecturaMeteo).all():
            db.delete(row)
        db.commit()
        r = client.get("/api/v1/weather/current", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get("impacto_productivo") is None
        assert data.get("suficiencia") == "insufficient_data"
        assert data.get("temperatura_actual") is None

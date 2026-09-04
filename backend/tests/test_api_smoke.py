def test_static_routes_do_not_collide_with_id_routes(client, auth_headers):
    animals_count = client.get("/api/v1/animals/active-count", headers=auth_headers)
    assert animals_count.status_code == 200
    assert isinstance(animals_count.json(), int)
    assert animals_count.json() >= 0

    quality_summary = client.get("/api/v1/lactations/quality/summary", headers=auth_headers)
    assert quality_summary.status_code == 200
    assert quality_summary.json()["lactaciones_activas"] >= 1

    critical_alerts = client.get("/api/v1/alerts/critical", headers=auth_headers)
    assert critical_alerts.status_code == 200
    assert critical_alerts.json()["total"] == 0


def test_alerts_smoke_flow(client, auth_headers):
    payload = {
        "animal_id": "animal-smoke",
        "tipo_alerta": "produccion_baja",
        "severidad": "alta",
        "descripcion": "Produccion por debajo del umbral",
        "recomendacion": "Revisar alimentacion y estado sanitario",
        "confianza_prediccion": 80,
    }

    created = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert created.status_code == 201
    alert_id = created.json()["id"]

    listed = client.get("/api/v1/alerts", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    detailed = client.get(f"/api/v1/alerts/detail/{alert_id}", headers=auth_headers)
    assert detailed.status_code == 200
    assert detailed.json()["id"] == alert_id

    updated = client.patch(
        f"/api/v1/alerts/{alert_id}",
        json={"estado": "revisada", "notas_operario": "Revisada en test"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["estado"] == "revisada"


def test_frontend_core_requires_authentication(client):
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 403


def test_role_restrictions_for_sensitive_mutations(client, operario_headers):
    response = client.post(
        "/api/v1/employees",
        json={"nombre": "Sin permiso", "role": "operario"},
        headers=operario_headers,
    )
    assert response.status_code == 403

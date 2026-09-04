def test_operational_e2e_flow(client, auth_headers):
    dashboard = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert dashboard.status_code == 200

    task = client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={
            "tarea_catalogo_id": "e2e-check",
            "tarea_catalogo": {
                "nombre": "Revision E2E de sala",
                "categoria": "operativa",
                "frecuencia": "puntual",
                "zona_aplicable": "ordeno",
            },
            "zona_id": "ordeno",
            "fecha_programada": "2026-05-26T09:00:00",
            "estado": "programada",
            "es_urgente": True,
        },
    )
    assert task.status_code == 201

    completed = client.put(
        f"/api/v1/tasks/{task.json()['id']}",
        headers=auth_headers,
        json={"estado": "ejecutada", "resultado": "ok", "observaciones": "Flujo E2E completado"},
    )
    assert completed.status_code == 200
    assert completed.json()["estado"] == "ejecutada"

    incident = client.post(
        "/api/v1/incidents",
        headers=auth_headers,
        json={
            "tipo": "Operativa - prueba E2E",
            "zona_id": "ordeno",
            "descripcion": "Incidencia creada por el flujo E2E",
            "prioridad": "media",
        },
    )
    assert incident.status_code == 201
    assert incident.json()["estado"] == "abierta"

    alert = client.post(
        "/api/v1/alerts",
        headers=auth_headers,
        json={
            "animal_id": "animal-001",
            "tipo_alerta": "calidad_leche",
            "severidad": "alta",
            "descripcion": "Alerta creada por el flujo E2E",
            "recomendacion": "Revisar en el siguiente control",
            "confianza_prediccion": 0.75,
        },
    )
    assert alert.status_code == 201

    reviewed = client.patch(
        f"/api/v1/alerts/{alert.json()['id']}",
        headers=auth_headers,
        json={"estado": "revisada", "notas_operario": "Revisada en flujo E2E"},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["estado"] == "revisada"
    assert reviewed.json()["revisada"] is True

    persisted_incident = client.get(f"/api/v1/incidents/{incident.json()['id']}", headers=auth_headers)
    assert persisted_incident.status_code == 200
    assert persisted_incident.json()["descripcion"] == "Incidencia creada por el flujo E2E"

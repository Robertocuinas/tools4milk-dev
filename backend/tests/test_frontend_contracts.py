def test_health_contract_matches_frontend(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
        "environment": "development",
    }


def test_dashboard_contract_matches_frontend(client, auth_headers):
    response = client.get("/api/v1/dashboard/summary", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"alertas", "tareas", "animales", "tratamientos"}
    assert {"total_pendientes", "criticas", "altas"} <= set(data["alertas"])
    assert {"programadas", "ejecutadas", "retrasadas"} <= set(data["tareas"])
    assert "activos" in data["animales"]
    assert "activos" in data["tratamientos"]


def test_list_contracts_match_frontend(client, auth_headers):
    animals = client.get("/api/v1/animals", headers=auth_headers).json()
    zones = client.get("/api/v1/zones", headers=auth_headers).json()
    tasks = client.get("/api/v1/tasks", headers=auth_headers).json()

    assert animals
    assert {"id", "crotal_oficial", "fecha_nacimiento", "fecha_entrada", "estado"} <= set(animals[0])
    assert zones
    assert {"id", "nombre", "codigo", "tiene_pantalla_tv", "tiene_tablet"} <= set(zones[0])
    assert tasks
    assert {"id", "tarea_catalogo", "fecha_programada", "estado", "es_urgente"} <= set(tasks[0])


def test_alerts_contract_matches_frontend(client, auth_headers):
    response = client.get("/api/v1/alerts", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert {"total", "alertas", "estadisticas", "skip", "limit"} <= set(data)
    assert isinstance(data["alertas"], list)


def test_prediction_contract_matches_frontend(client, auth_headers):
    response = client.get("/api/v1/predictions/animal-001", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["animal_id"] == "animal-001"
    assert data["timestamp"]
    assert {"tendencia", "produccion_promedio_predicha", "confidence"} <= set(data["produccion"])
    assert {"grasa", "proteina", "confidence"} <= set(data["composicion"])
    assert {"riesgo_promedio", "confidence"} <= set(data["riesgo_sanitario"])
    assert data["_mock"] is False


def test_operational_modules_are_persisted(client, auth_headers):
    lactations = client.get("/api/v1/lactations", headers=auth_headers)
    assert lactations.status_code == 200
    assert lactations.json()
    assert {"id", "animal_id", "produccion_promedio", "grasa_promedio"} <= set(lactations.json()[0])

    quality = client.get("/api/v1/lactations/quality/summary", headers=auth_headers)
    assert quality.status_code == 200
    assert quality.json()["lactaciones_activas"] >= 1

    treatments = client.get("/api/v1/treatments", headers=auth_headers)
    assert treatments.status_code == 200
    assert treatments.json()
    assert {"id", "animal_id", "fecha_inicio", "activo"} <= set(treatments.json()[0])

    employees = client.get("/api/v1/employees", headers=auth_headers)
    assert employees.status_code == 200
    assert employees.json()
    assert {"id", "nombre", "role", "activo"} <= set(employees.json()[0])

    machinery = client.get("/api/v1/machinery", headers=auth_headers)
    assert machinery.status_code == 200
    assert machinery.json()
    assert {"id", "nombre", "tipo", "estado"} <= set(machinery.json()[0])


def test_operational_modules_support_updates(client, auth_headers):
    lactation = client.post(
        "/api/v1/lactations",
        headers=auth_headers,
        json={
            "animal_id": "animal-001",
            "numero_lactacion": 3,
            "fecha_inicio": "2026-05-01",
            "produccion_promedio": 31.5,
            "grasa_promedio": 3.9,
            "proteina_promedio": 3.2,
            "activa": True,
        },
    )
    assert lactation.status_code == 201
    lactation_update = client.put(
        f"/api/v1/lactations/{lactation.json()['id']}",
        headers=auth_headers,
        json={"produccion_promedio": 32.1, "activa": False},
    )
    assert lactation_update.status_code == 200
    assert lactation_update.json()["produccion_promedio"] == 32.1
    assert lactation_update.json()["activa"] is False

    employee = client.post(
        "/api/v1/employees",
        headers=auth_headers,
        json={"nombre": "Eva", "apellidos": "Prueba", "role": "operario", "activo": True},
    )
    assert employee.status_code == 201
    employee_update = client.put(
        f"/api/v1/employees/{employee.json()['id']}",
        headers=auth_headers,
        json={"role": "alimentacion"},
    )
    assert employee_update.status_code == 200
    assert employee_update.json()["role"] == "alimentacion"

    machinery = client.post(
        "/api/v1/machinery",
        headers=auth_headers,
        json={"nombre": "Robot test", "tipo": "ordeno", "estado": "operativa"},
    )
    assert machinery.status_code == 201
    machinery_update = client.put(
        f"/api/v1/machinery/{machinery.json()['id']}",
        headers=auth_headers,
        json={"estado": "revision"},
    )
    assert machinery_update.status_code == 200
    assert machinery_update.json()["estado"] == "revision"

    incident = client.post(
        "/api/v1/incidents",
        headers=auth_headers,
        json={
            "animal_id": "animal-001",
            "tipo": "sanitaria",
            "descripcion": "Cojera leve observada en control",
            "prioridad": "media",
        },
    )
    assert incident.status_code == 201
    incidents = client.get("/api/v1/incidents?animal_id=animal-001", headers=auth_headers)
    assert incidents.status_code == 200
    assert incidents.json()
    assert all(item["animal_id"] == incident.json()["animal_id"] for item in incidents.json())

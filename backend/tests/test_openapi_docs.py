from fastapi.testclient import TestClient

from app.main import app


def test_docs_and_redoc_are_available():
    with TestClient(app) as client:
        assert client.get("/docs").status_code == 200
        assert client.get("/redoc").status_code == 200


def test_openapi_schema_contains_developer_metadata():
    with TestClient(app) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()

    assert schema["info"]["title"]
    assert schema["info"]["version"]
    assert "TV por zona" in schema["info"]["description"]
    assert "servers" in schema
    assert "x-tagGroups" in schema
    assert "bearerAuth" in schema["components"]["securitySchemes"]
    assert schema["components"]["schemas"]["Provenance"]["properties"]["source"]["enum"] == ["generated", "aemet_real"]
    assert "heuristic_arithmetic" in schema["components"]["schemas"]["HeuristicPredictionMetadata"]["properties"]["method"]["enum"]


def test_openapi_has_examples_for_core_frontend_flows():
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()

    animals_get = schema["paths"]["/api/v1/animals"]["get"]
    zones_post = schema["paths"]["/api/v1/zones"]["post"]
    tasks_get = schema["paths"]["/api/v1/tasks"]["get"]

    assert "examples" in animals_get["responses"]["200"]["content"]["application/json"]
    assert "examples" in zones_post["requestBody"]["content"]["application/json"]
    assert "examples" in tasks_get["responses"]["200"]["content"]["application/json"]

    for operation in (animals_get, zones_post, tasks_get):
        assert "422" in operation["responses"]
        assert "500" in operation["responses"]
        assert operation["operationId"]


def test_openapi_expone_serie_temporal_por_animal():
    """Release 4 DSS: GET /animals/{animal_id}/readings documentado y protegido."""
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()

    path = schema["paths"]["/api/v1/animals/{animal_id}/readings"]["get"]
    assert path["operationId"] == "list_animal_readings"
    assert "404" in path["responses"]
    assert "422" in path["responses"]
    assert "examples" in path["responses"]["200"]["content"]["application/json"]
    params = {p["name"] for p in path.get("parameters", [])}
    assert {"days", "limit"} <= params
    assert path["security"] == [{"HTTPBearer": []}]
    assert path["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AnimalReadingsResponse"
    }
    response_schema = schema["components"]["schemas"]["AnimalReadingsResponse"]
    assert {"animal_id", "provenance", "count", "days", "limit", "readings"} <= set(
        response_schema["required"]
    )


def test_openapi_expone_correlacion_meteo_descriptiva():
    """Release 4 DSS R4-3: GET /weather/correlation/impact documentado y protegido."""
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()

    path = schema["paths"]["/api/v1/weather/correlation/impact"]["get"]
    assert path["operationId"] == "weather_correlation_impact"
    assert "422" in path["responses"]
    assert "examples" in path["responses"]["200"]["content"]["application/json"]
    params = {p["name"] for p in path.get("parameters", [])}
    assert {"dias_adelante", "ventana_dias"} <= params
    assert path["security"] == [{"HTTPBearer": []}]
    assert path["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/WeatherCorrelationResponse"
    }
    response_schema = schema["components"]["schemas"]["WeatherCorrelationResponse"]
    assert {
        "ubicacion",
        "metodo",
        "status",
        "sample_size",
        "min_sample_size",
        "asociaciones",
        "aviso",
        "provenance",
    } <= set(response_schema["required"])

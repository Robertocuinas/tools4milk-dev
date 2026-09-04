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

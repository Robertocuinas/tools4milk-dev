from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from app.config import settings


def install_openapi(app: FastAPI) -> None:
    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema

        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        schema["servers"] = [{"url": settings.app_url, "description": "API"}]
        schema["x-tagGroups"] = [
            {"name": "Core", "tags": ["Auth", "Frontend Core", "Weather"]},
        ]
        schema.setdefault("components", {}).setdefault("securitySchemes", {})["bearerAuth"] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
        schemas = schema["components"].setdefault("schemas", {})
        schemas["Provenance"] = {
            "type": "object",
            "required": ["source", "mode", "synthetic"],
            "properties": {
                "source": {"type": "string", "enum": ["generated", "aemet_real"]},
                "mode": {"type": "string", "enum": ["synthetic", "real"]},
                "synthetic": {"type": "boolean"},
            },
        }
        schemas["HeuristicPredictionMetadata"] = {
            "type": "object",
            "required": ["provenance", "method", "validated", "limitations"],
            "properties": {
                "provenance": {"$ref": "#/components/schemas/Provenance"},
                "method": {"type": "string", "enum": ["heuristic_arithmetic"]},
                "validated": {"type": "boolean", "const": False},
                "limitations": {"type": "array", "items": {"type": "string"}},
            },
        }
        schema["info"]["description"] = (
            f"{app.description}\n\nRelease 1: demo sintética. "
            "Las lecturas generated y las predicciones heuristic_arithmetic no son producción ni validación de campo."
        )
        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi

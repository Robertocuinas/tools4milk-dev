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
        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi

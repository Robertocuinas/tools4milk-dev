"""Admin router — privileged operations not exposed in the regular API.

Endpoints here use the same JWT + role authorization as the rest of the API.
"""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings
from app.logging_utils import redact_configured_secret
from app.routers.deps import AdminOnly

logger = logging.getLogger("tools4milk.admin")

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/seed-data")
def seed_realistic_data(
    _user: AdminOnly,
    weather_days: int = Query(default=14, ge=1, le=365, description="Days of weather readings to generate"),
) -> dict[str, Any]:
    """Execute ``scripts/seed_realistic_data.py`` and return its output.

    The script is idempotent — re-running it will not duplicate existing rows.
    Pass ``weather_days`` to control how many days of meteorological readings
    are generated (default: 14).

    Requires an authenticated user with the canonical ``admin`` role.
    """
    if settings.environment.lower() == "production":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Synthetic seed is disabled in production")

    # Resolve the script path relative to the working directory (WORKDIR /app
    # in the Docker image, where scripts/ is copied alongside app/).
    script_path = Path("scripts/seed_realistic_data.py")
    if not script_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Seed script not found at '{script_path.resolve()}'. "
                   "Ensure the scripts/ directory is present in the working directory.",
        )

    cmd = [sys.executable, str(script_path), "--weather-days", str(weather_days)]
    logger.info("[admin] running seed script")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5-minute hard limit
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Seed script timed out after 300 seconds.",
        )
    except Exception as exc:
        logger.exception("[admin] unexpected error running seed script")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute seed script: {redact_configured_secret(exc, settings.aemet_api_key)}",
        ) from exc

    success = result.returncode == 0
    log_level = logging.INFO if success else logging.ERROR
    logger.log(log_level, "[admin] seed script exited with code %d", result.returncode)

    return {
        "success": success,
        "return_code": result.returncode,
        "weather_days": weather_days,
        "stdout": redact_configured_secret(result.stdout, settings.aemet_api_key),
        "stderr": redact_configured_secret(result.stderr, settings.aemet_api_key),
    }

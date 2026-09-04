"""Admin router — privileged operations not exposed in the regular API.

Endpoints here are protected by a static secret token passed via the
``X-Admin-Token`` request header.  Set the ``ADMIN_SECRET`` environment
variable in Railway (or your .env) to a strong random string.  If the
variable is not set the endpoints are disabled entirely (returns 503).
"""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, status

from app.config import settings

logger = logging.getLogger("tools4milk.admin")

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ADMIN_SECRET: str = getattr(settings, "admin_secret", "")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/seed-data")
def seed_realistic_data(
    weather_days: int = Query(default=14, ge=1, le=365, description="Days of weather readings to generate"),
    x_admin_token: str = Header(..., alias="X-Admin-Token"),
) -> dict[str, Any]:
    """Execute ``scripts/seed_realistic_data.py`` and return its output.

    The script is idempotent — re-running it will not duplicate existing rows.
    Pass ``weather_days`` to control how many days of meteorological readings
    are generated (default: 14).

    Requires the ``X-Admin-Token`` header to match the ``ADMIN_SECRET``
    environment variable.
    """
    # Validate token inline (avoids Depends() complexity with Header aliases)
    if not _ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin endpoints are disabled: ADMIN_SECRET is not configured.",
        )
    if x_admin_token != _ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token.",
        )

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
    logger.info("[admin] running seed script: %s", " ".join(cmd))

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
            detail=f"Failed to execute seed script: {exc}",
        ) from exc

    success = result.returncode == 0
    log_level = logging.INFO if success else logging.ERROR
    logger.log(log_level, "[admin] seed script exited with code %d", result.returncode)

    return {
        "success": success,
        "return_code": result.returncode,
        "weather_days": weather_days,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }

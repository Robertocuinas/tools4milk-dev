"""Helpers para evitar secretos en logs y mensajes de error."""

from __future__ import annotations

import re


_SENSITIVE_QUERY_KEYS = (
    "api_key",
    "apikey",
    "authorization",
    "access_token",
    "auth_token",
    "client_secret",
    "password",
    "secret",
    "token",
    "key",
)
_QUERY_SECRET_PATTERN = re.compile(
    rf"([?&](?:{'|'.join(_SENSITIVE_QUERY_KEYS)})=)[^&#\s]*",
    re.IGNORECASE,
)


def redact_sensitive_text(value: object) -> str:
    """Redacta valores de query sensibles y devuelve texto seguro para logs."""
    text = str(value)
    return _QUERY_SECRET_PATTERN.sub(r"\1[REDACTED]", text)


def redact_configured_secret(value: object, secret: str | None) -> str:
    """Redacta además un secreto configurado si aparece fuera de una URL."""
    text = redact_sensitive_text(value)
    if secret:
        text = text.replace(secret, "[REDACTED]")
    return text

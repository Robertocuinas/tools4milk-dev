"""Tests del middleware de headers de seguridad (R15).

El middleware añade a cada respuesta:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: no-referrer
- Content-Security-Policy: default-src 'none'; frame-ancestors 'none'

Y en producción:
- Strict-Transport-Security: max-age=31536000; includeSubDomains

En los tests, ``settings.environment`` es ``development`` por defecto,
así que HSTS NO se emite — verificamos que no esté, para asegurarnos
de que el middleware respeta el flag de entorno.
"""

import pytest
from fastapi import status


class TestSecurityHeaders:
    def test_security_headers_presentes_en_response(self, client):
        """Los 4 headers defensivos deben estar en cualquier respuesta."""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK

        assert response.headers.get("x-content-type-options") == "nosniff"
        assert response.headers.get("x-frame-options") == "DENY"
        assert response.headers.get("referrer-policy") == "no-referrer"
        csp = response.headers.get("content-security-policy", "")
        assert "default-src 'none'" in csp
        assert "frame-ancestors 'none'" in csp

    def test_hsts_no_emitido_en_desarrollo(self, client):
        """En dev (environment != production) HSTS NO se emite para
        no romper http://localhost."""
        response = client.get("/")
        assert "strict-transport-security" not in {
            k.lower() for k in response.headers.keys()
        }

    def test_security_headers_tambien_en_404(self, client):
        """Los headers se añaden a TODAS las respuestas, incluidos errores."""
        response = client.get("/api/v1/esta-ruta-no-existe")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.headers.get("x-content-type-options") == "nosniff"
        assert response.headers.get("x-frame-options") == "DENY"

    def test_security_headers_en_endpoints_protegidos(self, client):
        """Los headers se mantienen incluso cuando hay auth (login OK)."""
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "ghost", "password": "ghostpass"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.headers.get("x-content-type-options") == "nosniff"
        assert response.headers.get("x-frame-options") == "DENY"

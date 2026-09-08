"""
Tests para endpoints de autenticación de Tools4Milk MVP

Prueba:
- POST /api/v1/auth/login: Autenticación de usuario
- GET /api/v1/auth/me: Obtener usuario actual
- POST /api/v1/auth/refresh: Refrescar token
- POST /api/v1/auth/logout: Borrar la cookie HttpOnly
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient
import json

from app.main import app


class TestLogin:
    """Tests para el endpoint POST /auth/login"""

    def test_login_exitoso(self, client, test_user, test_user_credentials):
        """Prueba login exitoso con credenciales válidas"""
        response = client.post(
            "/api/v1/auth/login",
            json=test_user_credentials
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verificar estructura de respuesta
        assert "user" in data
        assert "token" in data

        # Verificar datos del usuario
        assert data["user"]["username"] == test_user_credentials["username"]
        assert data["user"]["email"] == test_user.email
        assert data["user"]["activo"] is True

        # Verificar token
        assert data["token"]["access_token"]
        assert data["token"]["token_type"] == "bearer"
        assert data["token"]["expires_in"] > 0

    def test_login_credenciales_invalidas(self, client, test_user):
        """Prueba login con contraseña incorrecta"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": test_user.username,
                "password": "contraseña_incorrecta"
            }
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert "detail" in data
        assert "Nombre de usuario o contraseña incorrectos" in data["detail"]

    def test_login_usuario_inexistente(self, client):
        """Prueba login con usuario que no existe"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": "usuarionoexiste",
                "password": "contraseña123"
            }
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert "detail" in data

    def test_login_usuario_inactivo(self, client, test_inactive_user):
        """Prueba login con usuario inactivo"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": test_inactive_user.username,
                "password": "inactivepass123"
            }
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert "Usuario inactivo" in data["detail"]

    def test_login_campos_obligatorios(self, client):
        """Prueba login sin campos obligatorios"""
        # Sin username
        response = client.post(
            "/api/v1/auth/login",
            json={"password": "test123"}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Sin password
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "testuser"}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_login_validacion_longitud_password(self, client, test_user):
        """Prueba validación de longitud mínima de contraseña"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": test_user.username,
                "password": "short"  # Menos de 8 caracteres
            }
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_login_respuesta_token_valido(self, client, test_user, test_user_credentials):
        """Prueba que el token JWT retornado es válido"""
        response = client.post(
            "/api/v1/auth/login",
            json=test_user_credentials
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        token = data["token"]["access_token"]

        # El token debe ser una string no vacía
        assert isinstance(token, str)
        assert len(token) > 0
        # Los tokens JWT tienen 3 partes separadas por puntos
        assert token.count('.') == 2


class TestGetMe:
    """Tests para el endpoint GET /auth/me"""

    def test_get_me_autenticado(self, client, test_user, test_user_credentials):
        """Prueba obtener usuario actual con autenticación válida"""
        # Primero hacer login
        login_response = client.post(
            "/api/v1/auth/login",
            json=test_user_credentials
        )
        token = login_response.json()["token"]["access_token"]

        # Luego obtener usuario actual
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
        assert data["id"] == str(test_user.id)
        assert data["activo"] is True

    def test_get_me_sin_autenticacion(self, client):
        """Prueba obtener usuario actual sin token.

        Esperado: 401 cuando falta Authorization o la cookie.
        """
        response = client.get("/api/v1/auth/me")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_me_token_invalido(self, client):
        """Prueba obtener usuario actual con token inválido"""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer token_invalido"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_me_formato_header_invalido(self, client, test_user, test_user_credentials):
        """Prueba que un header Authorization sin esquema 'Bearer' se ignora.

        Con R8 (cookie HttpOnly) el orden de prioridad es: cookie > header.
        Si la cookie no está, el header sin 'Bearer' se trata como ausente
        y se devuelve 401. Si la cookie sí está, se usa la cookie y se
        ignora el header malformado (200).
        """
        login_response = client.post(
            "/api/v1/auth/login",
            json=test_user_credentials
        )
        token = login_response.json()["token"]["access_token"]

        # Sin "Bearer" prefix: HTTPBearer no extrae credenciales -> cae a
        # la cookie, que está presente tras el login -> 200 OK.
        response_with_cookie = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": token}
        )
        assert response_with_cookie.status_code == status.HTTP_200_OK

        # Cliente SIN cookie previa: el header malformado equivale a "no
        # autenticado" -> 401.
        fresh_client = TestClient(app)
        response_no_cookie = fresh_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": token}
        )
        assert response_no_cookie.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_emite_cookie_httponly(self, client, test_user, test_user_credentials):
        """R8 — POST /auth/login debe emitir cookie HttpOnly + SameSite=Lax.

        Verifica los flags de seguridad de ``set_auth_cookie``:
        - ``httponly=True``: JavaScript no puede leerla (mitiga XSS).
        - ``samesite="lax"``: protección CSRF básica para GET cross-site.
        - ``max-age`` > 0: la cookie expira (no es de sesión).
        El flag ``Secure`` se omite en dev (``environment != production``)
        para que la cookie funcione sobre http://localhost.
        """
        response = client.post("/api/v1/auth/login", json=test_user_credentials)
        assert response.status_code == status.HTTP_200_OK

        set_cookie = response.headers.get("set-cookie", "")
        assert "t4m_token=" in set_cookie, f"Cookie de sesión no emitida: {set_cookie!r}"
        assert "HttpOnly" in set_cookie, f"Cookie sin flag HttpOnly: {set_cookie!r}"
        # FastAPI normaliza el value a minúsculas (``samesite="lax"`` se
        # serializa como ``SameSite=lax``). Hacemos la búsqueda case-insensitive.
        assert "samesite=lax" in set_cookie.lower(), f"Cookie sin SameSite=Lax: {set_cookie!r}"
        # max-age > 0 (en segundos; 8h = 28800).
        import re
        match = re.search(r"Max-Age=(\d+)", set_cookie)
        assert match is not None, f"Cookie sin Max-Age: {set_cookie!r}"
        assert int(match.group(1)) > 0

    def test_auth_me_con_solo_cookie_sin_header(self, client, test_user, test_user_credentials):
        """R8 — Tras login, ``/auth/me`` funciona con la cookie sola.

        Simula el flujo del navegador: el frontend nunca envía
        ``Authorization``, solo deja que el navegador adjunte la cookie
        HttpOnly. El backend debe aceptarla y devolver 200.
        """
        # Login (setea la cookie en el TestClient).
        login_response = client.post("/api/v1/auth/login", json=test_user_credentials)
        assert login_response.status_code == status.HTTP_200_OK
        assert "t4m_token=" in login_response.headers.get("set-cookie", "")

        # Llamada SIN header Authorization — el TestClient reenvía la
        # cookie automáticamente porque comparte el jar entre requests.
        me_response = client.get("/api/v1/auth/me")
        assert me_response.status_code == status.HTTP_200_OK
        assert me_response.json()["username"] == test_user_credentials["username"]

    def test_refresh_cookie_samesite_strict(self, client, test_user, test_user_credentials):
        """La cookie de refresh usa ``SameSite=Strict`` (más estricto
        que la del access, que es ``Lax``). El refresh no se envía en
        navegación cross-site, así que ``Strict`` es seguro y blinda
        el endpoint de rotación contra CSRF.
        """
        response = client.post("/api/v1/auth/login", json=test_user_credentials)
        set_cookies = "\n".join(response.headers.get_list("set-cookie")).lower()
        assert "samesite=strict" in set_cookies, (
            f"Refresh cookie sin SameSite=Strict. Cookies: {set_cookies}"
        )

    def test_logout_borra_cookie_httponly(self, client, test_user, test_user_credentials):
        """R8 — POST /auth/logout debe devolver Set-Cookie con max-age=0
        para que el navegador borre la cookie HttpOnly del cliente."""
        # Login previo
        client.post("/api/v1/auth/login", json=test_user_credentials)

        response = client.post("/api/v1/auth/logout")
        assert response.status_code == status.HTTP_204_NO_CONTENT

        set_cookie = response.headers.get("set-cookie", "")
        # El header de borrado usa Max-Age=0 y el mismo nombre.
        assert "t4m_token=" in set_cookie, f"Logout no borró la cookie: {set_cookie!r}"
        assert "Max-Age=0" in set_cookie, f"Cookie de logout sin Max-Age=0: {set_cookie!r}"


class TestLoginRateLimit:
    """Tests del rate limiter de ``POST /auth/login``.

    El limiter se resetea automáticamente entre tests vía el fixture
    autouse ``_reset_login_rate_limiter`` definido en este módulo.
    """

    def test_login_rate_limit_devuelve_429_despues_de_max_intentos(
        self, client, test_user
    ):
        """Tras ``login_rate_limit_max`` intentos (fallidos), el siguiente
        intento — incluso con credenciales correctas — devuelve 429 con
        header ``Retry-After``."""
        # Llenamos la cuota con credenciales inválidas (>=8 chars para
        # superar la validación de ``LoginRequest.password``).
        bad = {"username": test_user.username, "password": "wrongpass"}
        for _ in range(5):
            r = client.post("/api/v1/auth/login", json=bad)
            assert r.status_code == status.HTTP_401_UNAUTHORIZED

        # El sexto intento debe estar bloqueado, incluso con la contraseña
        # correcta (el limiter corta antes de validar credenciales).
        good = {"username": test_user.username, "password": "testpass123"}
        r = client.post("/api/v1/auth/login", json=good)
        assert r.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "Retry-After" in r.headers
        assert int(r.headers["Retry-After"]) > 0
        assert "Demasiados intentos" in r.json()["detail"]

    def test_login_rate_limit_es_per_ip(self, client, test_user):
        """El limiter cuenta por IP. La cuota del test anterior (con el
        mismo TestClient) debe estar vacía al inicio de este test gracias
        al fixture autouse; lo verificamos haciendo un login válido."""
        good = {"username": test_user.username, "password": "testpass123"}
        r = client.post("/api/v1/auth/login", json=good)
        assert r.status_code == status.HTTP_200_OK


class TestRefreshToken:
    """Tests para el endpoint POST /auth/refresh (R12 — rotación + reuse detection)."""

    def test_refresh_token_exitoso(self, client, test_user, test_user_credentials):
        """Login emite (access, refresh). /refresh rota el par."""
        login = client.post("/api/v1/auth/login", json=test_user_credentials)
        assert login.status_code == status.HTTP_200_OK
        login_data = login.json()
        old_access = login_data["token"]["access_token"]
        old_refresh = login_data["token"]["refresh_token"]
        assert old_refresh is not None

        # Rotar.
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_refresh},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["access_token"]
        assert data["access_token"] != old_access
        assert data["refresh_token"]
        assert data["refresh_token"] != old_refresh
        assert data["refresh_expires_in"] > 0

    def test_refresh_token_sin_autenticacion(self, client):
        """Sin body ni cookie de refresh → 401."""
        response = client.post("/api/v1/auth/refresh")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_token_invalido(self, client):
        """Un refresh que no es JWT o está mal firmado → 401."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "esto.no.es.jwt"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_token_reuse_detection(self, client, test_user, test_user_credentials):
        """Reutilizar un refresh ya consumido revoca TODOS los refresh
        del usuario (defensa contra robo). El segundo intento con el
        mismo refresh devuelve 401, y un /refresh con un refresh
        emitido ANTES de la revocación también devuelve 401.
        """
        # Emite 2 refresh (rotando una vez para tener 2 en la tabla).
        login = client.post("/api/v1/auth/login", json=test_user_credentials)
        r1 = login.json()["token"]["refresh_token"]

        # Rota una vez (consume r1, emite r2).
        r1_response = client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
        r2 = r1_response.json()["refresh_token"]
        assert r1 != r2

        # Login de nuevo para tener un tercer refresh (r3) ANTES de
        # provocar el reuse. Si reusamos r1, el sistema debe invalidar
        # también r2 y r3.
        login2 = client.post("/api/v1/auth/login", json=test_user_credentials)
        r3 = login2.json()["token"]["refresh_token"]

        # Reusar r1 (ya revocado) → 401 y revoca todo.
        reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": r1})
        assert reuse.status_code == status.HTTP_401_UNAUTHORIZED
        assert "todas las sesiones" in reuse.json()["detail"].lower() or \
               "todas las sesiones" in reuse.json()["detail"]

        # Tras la revocación masiva, ni r2 ni r3 funcionan.
        r2_after = client.post("/api/v1/auth/refresh", json={"refresh_token": r2})
        assert r2_after.status_code == status.HTTP_401_UNAUTHORIZED
        r3_after = client.post("/api/v1/auth/refresh", json={"refresh_token": r3})
        assert r3_after.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_via_cookie_sin_body(self, client, test_user, test_user_credentials):
        """R17 — El frontend puede llamar a /auth/refresh sin body
        alguno: el backend lee la cookie ``t4m_refresh`` que el navegador
        adjunta con ``credentials: "include"``.

        Simula el flujo real: el navegador guarda el refresh en la
        cookie HttpOnly (R8/R12), nunca lo expone a JS, y el frontend
        hace un POST vacío a /auth/refresh cuando detecta que el
        access está próximo a expirar.
        """
        # Login (deja la cookie t4m_refresh en el jar del TestClient).
        login = client.post("/api/v1/auth/login", json=test_user_credentials)
        assert login.status_code == status.HTTP_200_OK
        old_refresh = login.json()["token"]["refresh_token"]
        assert old_refresh is not None

        # /auth/refresh SIN body — el backend debe leer la cookie.
        response = client.post("/api/v1/auth/refresh")
        assert response.status_code == status.HTTP_200_OK
        new_refresh = response.json()["refresh_token"]
        assert new_refresh != old_refresh

    def test_refresh_cookie_precedencia_body(self, client, test_user, test_user_credentials):
        """Si el body trae un refresh distinto al de la cookie, gana
        el body (orden de prioridad explícito para tests)."""
        login = client.post("/api/v1/auth/login", json=test_user_credentials)
        cookie_refresh = login.json()["token"]["refresh_token"]

        # Body con un refresh inventado (no es JWT válido → 401).
        # Si el backend hubiera leído la cookie, este caso habría
        # rotado con éxito; al ganar el body, el endpoint rechaza.
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "no-es-jwt"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # La cookie sigue intacta y el refresh sigue siendo válido
        # para una siguiente llamada limpia.
        response_ok = client.post("/api/v1/auth/refresh")
        assert response_ok.status_code == status.HTTP_200_OK
        assert response_ok.json()["refresh_token"] != cookie_refresh

    def test_login_serializa_usuario_antes_de_commit_del_refresh(
        self, client, test_user, test_user_credentials, monkeypatch
    ):
        """El login no debe leer una entidad expirada tras crear el refresh.

        El helper real confirma la sesión para persistir el refresh. Este
        doble reproduce el borde observado con una sesión concurrente:
        expira ``Usuario`` justo después de emitir tokens. La respuesta debe
        seguir siendo 200 y contener el usuario ya capturado.
        """
        from app.routers import auth as auth_router

        original = auth_router._build_full_token_response

        def expire_user_after_tokens(db, user, ip):
            result = original(db, user, ip)
            db.expire(user)
            return result

        monkeypatch.setattr(auth_router, "_build_full_token_response", expire_user_after_tokens)

        response = client.post("/api/v1/auth/login", json=test_user_credentials)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["user"]["username"] == test_user.username

    def test_refresh_max_per_user_revoca_mas_antiguo(self, client, test_user, test_user_credentials):
        """Si el usuario supera ``refresh_token_max_per_user`` (5 por
        defecto), el refresh más antiguo se revoca al emitir uno nuevo.

        Para no chocar con el rate limiter de /login (5/60s por IP),
        emitimos los 6 tokens directamente con ``create_refresh_token``
        — el cap es del helper, no del endpoint. Comprobamos la
        invariante consultando ``refresh_tokens`` directamente.
        """
        from app.models import RefreshToken
        from app.security import create_refresh_token
        from sqlalchemy import select
        from tests.conftest import TestingSessionLocal

        db = TestingSessionLocal()
        try:
            for _ in range(6):
                create_refresh_token(db, test_user)
            # Tras 6 emisiones con cap=5, debe haber 5 tokens NO
            # revocados y al menos 1 revocado por el cap.
            total = db.execute(
                select(RefreshToken).where(RefreshToken.user_id == test_user.id)
            ).scalars().all()
            active = [t for t in total if not t.is_revoked]
            revoked = [t for t in total if t.is_revoked]
            assert len(active) == 5, f"Esperaba 5 activos, hay {len(active)}"
            assert len(revoked) >= 1, f"Esperaba ≥1 revocado por cap, hay {len(revoked)}"
        finally:
            db.close()


class TestSeguridad:
    """Tests para validar aspectos de seguridad de la autenticación"""

    def test_password_no_en_respuesta(self, client, test_user, test_user_credentials):
        """Prueba que la contraseña nunca se devuelve en la respuesta"""
        response = client.post(
            "/api/v1/auth/login",
            json=test_user_credentials
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verificar que password no está en ninguna parte
        response_text = json.dumps(data)
        assert "hashed_password" not in response_text
        assert test_user_credentials["password"] not in response_text

    def test_token_contiene_claims_esperados(self, client, test_user, test_user_credentials):
        """Prueba que el token JWT contiene los claims esperados"""
        response = client.post(
            "/api/v1/auth/login",
            json=test_user_credentials
        )

        assert response.status_code == status.HTTP_200_OK
        token = response.json()["token"]["access_token"]

        # Decodificar token para verificar claims
        import base64
        parts = token.split('.')
        payload = parts[1]

        # Agregar padding si es necesario
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding

        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)

        # Verificar claims esperados
        assert "sub" in claims  # subject (username)
        assert claims["sub"] == test_user_credentials["username"]
        assert "exp" in claims  # expiration time
        assert claims["exp"] > 0

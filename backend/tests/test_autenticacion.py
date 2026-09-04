"""
Tests para endpoints de autenticación de Tools4Milk MVP

Prueba:
- POST /api/v1/auth/login: Autenticación de usuario
- GET /api/v1/auth/me: Obtener usuario actual
- POST /api/v1/auth/refresh: Refrescar token
"""

import pytest
from fastapi import status
import json


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
        """Prueba obtener usuario actual sin token"""
        response = client.get("/api/v1/auth/me")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_me_token_invalido(self, client):
        """Prueba obtener usuario actual con token inválido"""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer token_invalido"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_me_formato_header_invalido(self, client, test_user, test_user_credentials):
        """Prueba obtener usuario actual con formato de Authorization inválido"""
        login_response = client.post(
            "/api/v1/auth/login",
            json=test_user_credentials
        )
        token = login_response.json()["token"]["access_token"]

        # Sin "Bearer" prefix
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": token}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestRefreshToken:
    """Tests para el endpoint POST /auth/refresh"""

    def test_refresh_token_exitoso(self, client, test_user, test_user_credentials):
        """Prueba refrescar token válido"""
        # Primero hacer login
        login_response = client.post(
            "/api/v1/auth/login",
            json=test_user_credentials
        )
        old_token = login_response.json()["token"]["access_token"]

        # Refrescar token
        response = client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {old_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # El nuevo token debe ser diferente
        assert data["access_token"]
        assert data["access_token"] != old_token
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    def test_refresh_token_sin_autenticacion(self, client):
        """Prueba refrescar token sin autenticación"""
        response = client.post("/api/v1/auth/refresh")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_refresh_token_invalido(self, client):
        """Prueba refrescar token inválido"""
        response = client.post(
            "/api/v1/auth/refresh",
            headers={"Authorization": "Bearer token_invalido"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


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

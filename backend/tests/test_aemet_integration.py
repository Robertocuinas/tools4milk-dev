"""
Tests para integracion AEMET API

Cubre:
- Sincronizacion de datos
- Endpoints de meteorologia
- Correlaciones clima-produccion
- Manejo de errores
"""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.datos_metereologicos import DatosMetereologicos
from app.services.aemet_client import aemet_client
from app.time_utils import utc_now


class TestAEMETClient:
    """Tests del cliente AEMET"""

    @pytest.mark.asyncio
    async def test_sincronizar_datos_generados(self, db):
        """Test sincronizacion con datos generados (sin API)"""
        resumen = await aemet_client.sincronizar_datos(db)

        assert resumen["registros_insertados"] > 0
        assert "registros_actualizados" in resumen
        assert "timestamp" in resumen

        stmt = select(DatosMetereologicos)
        registros = db.execute(stmt).scalars().all()
        assert len(registros) > 0

    @pytest.mark.asyncio
    async def test_datos_generados_tienen_estructura(self, db):
        """Test que datos generados tienen estructura correcta"""
        await aemet_client.sincronizar_datos(db)

        stmt = select(DatosMetereologicos).limit(1)
        registro = db.execute(stmt).scalar_one_or_none()

        assert registro is not None
        assert registro.fecha_hora is not None
        assert registro.ubicacion == "Villalba, Lugo"
        assert registro.fuente == "AEMET"
        assert registro.latitud == 42.6447
        assert registro.longitud == -8.1278


class TestWeatherEndpoints:
    """Tests de endpoints de meteorologia"""

    def test_obtener_clima_actual(self, client, db):
        """Test endpoint /weather/current"""
        ahora = utc_now()
        hoy = ahora.date()

        dato = DatosMetereologicos(
            fecha_hora=datetime.fromisoformat(f"{hoy}T12:00:00"),
            temperatura_media=18.5,
            temperatura_maxima=22,
            temperatura_minima=14,
            humedad_relativa=65,
            precipitacion=0,
            velocidad_viento=4.5,
            presion_atmosferica=1013,
            estado_cielo="parcialmente nublado",
            ubicacion="Villalba, Lugo",
            latitud=42.6447,
            longitud=-8.1278,
            fuente="AEMET",
        )
        db.add(dato)
        db.commit()

        response = client.get("/api/v1/weather/current")

        assert response.status_code == 200
        data = response.json()
        assert "temperatura" in data
        assert "ubicacion" in data
        assert data["ubicacion"] == "Villalba, Lugo"

    def test_obtener_prediccion_7dias(self, client, db):
        """Test endpoint /weather/forecast"""
        response = client.get("/api/v1/weather/forecast")

        assert response.status_code == 200
        data = response.json()
        assert "ubicacion" in data
        assert "dias" in data or data["dias"] == []

    def test_obtener_historico_clima(self, client, db):
        """Test endpoint /weather/historical"""
        response = client.get("/api/v1/weather/historical?dias_atras=30")

        assert response.status_code in [200, 404]

    def test_sincronizar_aemet(self, client, db):
        """Test endpoint /weather/sync"""
        response = client.post("/api/v1/weather/sync")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "success"

    def test_impacto_clima_produccion(self, client, db):
        """Test endpoint /weather/correlation/impact"""
        response = client.get("/api/v1/weather/correlation/impact?dias_adelante=7")

        assert response.status_code == 200
        data = response.json()
        assert "ubicacion" in data
        assert "impactos_predichos" in data


class TestWeatherDataProperties:
    """Tests de propiedades de datos meteorologicos"""

    def test_es_lluvia_property(self, db):
        """Test propiedad es_lluvia"""
        dato = DatosMetereologicos(
            fecha_hora=utc_now(),
            precipitacion=2.5,
            ubicacion="Villalba, Lugo",
        )

        assert dato.es_lluvia is True

        dato2 = DatosMetereologicos(
            fecha_hora=utc_now(),
            precipitacion=0,
            ubicacion="Villalba, Lugo",
        )

        assert dato2.es_lluvia is False

    def test_es_dia_frio_property(self, db):
        """Test propiedad es_dia_frio"""
        dato = DatosMetereologicos(
            fecha_hora=utc_now(),
            temperatura_media=3.5,
            ubicacion="Villalba, Lugo",
        )

        assert dato.es_dia_frio is True

        dato2 = DatosMetereologicos(
            fecha_hora=utc_now(),
            temperatura_media=8.0,
            ubicacion="Villalba, Lugo",
        )

        assert dato2.es_dia_frio is False

    def test_es_dia_calido_property(self, db):
        """Test propiedad es_dia_calido"""
        dato = DatosMetereologicos(
            fecha_hora=utc_now(),
            temperatura_media=26.5,
            ubicacion="Villalba, Lugo",
        )

        assert dato.es_dia_calido is True

        dato2 = DatosMetereologicos(
            fecha_hora=utc_now(),
            temperatura_media=20.0,
            ubicacion="Villalba, Lugo",
        )

        assert dato2.es_dia_calido is False

    def test_es_viento_fuerte_property(self, db):
        """Test propiedad es_viento_fuerte"""
        dato = DatosMetereologicos(
            fecha_hora=utc_now(),
            velocidad_viento=12.5,
            ubicacion="Villalba, Lugo",
        )

        assert dato.es_viento_fuerte is True

        dato2 = DatosMetereologicos(
            fecha_hora=utc_now(),
            velocidad_viento=5.0,
            ubicacion="Villalba, Lugo",
        )

        assert dato2.es_viento_fuerte is False

    def test_humedad_alta_property(self, db):
        """Test propiedad humedad_alta"""
        dato = DatosMetereologicos(
            fecha_hora=utc_now(),
            humedad_relativa=85,
            ubicacion="Villalba, Lugo",
        )

        assert dato.humedad_alta is True

        dato2 = DatosMetereologicos(
            fecha_hora=utc_now(),
            humedad_relativa=70,
            ubicacion="Villalba, Lugo",
        )

        assert dato2.humedad_alta is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

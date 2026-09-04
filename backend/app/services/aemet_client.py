from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.datos_metereologicos import DatosMetereologicos
from app.models.tools4milk import LecturaMeteo
from app.time_utils import utc_now

ESTACION_ID = "villalba_lugo"


class AemetClient:
    """AEMET weather data client with offline fallback.
    
    This client attempts to fetch real weather forecast data from AEMET (Spanish National Meteorological Agency).
    If no API key is configured or the API call fails, it falls back to generating synthetic weather data
    to allow the application to function without external dependencies.
    
    Generated data: synthetic temperature, humidity, precipitation, and wind for demo/offline mode.
    Real data: actual forecast from AEMET API when AEMET_API_KEY is configured.
    """
    api_base_url = "https://opendata.aemet.es/opendata/api"
    location_name = "Villalba, Lugo"
    latitud = 42.6447
    longitud = -8.1278

    async def sincronizar_datos(self, db: Session) -> dict[str, object]:
        """Synchronize weather data. Falls back to synthetic data if API key is missing or API fails.
        
        Returns:
            dict with keys:
            - status: "success" or "error"
            - modo: "aemet_real", "generated", or "aemet_real" (error case)
            - registros_insertados: count of new records
            - registros_actualizados: count of updated records
            - error: error message if status is "error"
            - timestamp: ISO 8601 timestamp
        """
        if not settings.aemet_api_key.strip():
            return self._upsert_records(db, self._generated_records(), mode="generated")

        try:
            records = await self._fetch_real_forecast()
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            return {
                "status": "error",
                "modo": "aemet_real",
                "error": str(exc) or exc.__class__.__name__,
                "registros_insertados": 0,
                "registros_actualizados": 0,
                "timestamp": utc_now().isoformat(),
            }

        return self._upsert_records(db, records)

    def _generated_records(self) -> list[dict[str, Any]]:
        base = utc_now().replace(tzinfo=None, hour=12, minute=0, second=0, microsecond=0)
        return [
            {
                "ts": base + timedelta(days=index),
                "estacion_id": ESTACION_ID,
                "temperatura_c": 14 + index,
                "humedad_relativa": 70 - index,
                "precipitacion_mm": None,
                "prob_precipitacion_pct": 10 if index % 2 else 40,
                "viento_km_h": 5 + index,
            }
            for index in range(7)
        ]

    async def _fetch_real_forecast(self) -> list[dict[str, Any]]:
        endpoint = f"{self.api_base_url}/prediccion/especifica/municipio/diaria/{settings.aemet_municipio_id}"
        headers = {"cache-control": "no-cache"}
        params = {"api_key": settings.aemet_api_key}
        async with httpx.AsyncClient(timeout=20) as client:
            metadata_response = await client.get(endpoint, params=params, headers=headers)
            metadata_response.raise_for_status()
            metadata = metadata_response.json()
            data_url = metadata.get("datos")
            if not data_url:
                raise ValueError(metadata.get("descripcion") or "AEMET no devolvio URL de datos")

            data_response = await client.get(data_url, headers=headers)
            data_response.raise_for_status()
            payload = data_response.json()

        municipality = payload[0] if isinstance(payload, list) and payload else payload
        days = municipality.get("prediccion", {}).get("dia", [])
        records = [self._parse_forecast_day(day) for day in days if day.get("fecha")]
        if not records:
            raise ValueError("AEMET no devolvio dias de prediccion para el municipio configurado")
        return records

    def _parse_forecast_day(self, day: dict[str, Any]) -> dict[str, Any]:
        fecha = datetime.fromisoformat(day["fecha"].replace("Z", "+00:00")).replace(tzinfo=None)
        maxima = self._to_float(day.get("temperatura", {}).get("maxima"))
        minima = self._to_float(day.get("temperatura", {}).get("minima"))
        temperatura_c = self._average(maxima, minima)
        humedad = self._average(
            self._to_float(day.get("humedadRelativa", {}).get("maxima")),
            self._to_float(day.get("humedadRelativa", {}).get("minima")),
        )
        # AEMET municipio/diaria devuelve PROBABILIDAD de precipitación (%), no mm.
        prob_precipitacion_pct = self._max_period_value(day.get("probPrecipitacion", []))
        viento_km_h = self._first_wind_speed(day.get("viento", []))

        return {
            "ts": fecha.replace(hour=12, minute=0, second=0, microsecond=0),
            "estacion_id": ESTACION_ID,
            "temperatura_c": temperatura_c,
            "humedad_relativa": humedad,
            "precipitacion_mm": None,
            "prob_precipitacion_pct": prob_precipitacion_pct,
            "viento_km_h": viento_km_h,
        }

    def _upsert_records(self, db: Session, records: list[dict[str, Any]], mode: str = "aemet_real") -> dict[str, object]:
        inserted = 0
        updated = 0

        for record in records:
            existing = db.execute(
                select(LecturaMeteo).where(
                    LecturaMeteo.ts == record["ts"],
                    LecturaMeteo.estacion_id == record["estacion_id"],
                )
            ).scalar_one_or_none()
            if existing:
                for key, value in record.items():
                    setattr(existing, key, value)
                updated += 1
                continue
            db.add(LecturaMeteo(**record))
            db.add(
                DatosMetereologicos(
                    fecha_hora=record["ts"],
                    temperatura_media=record.get("temperatura_c"),
                    humedad_relativa=record.get("humedad_relativa"),
                    precipitacion=record.get("precipitacion_mm"),
                    velocidad_viento=record.get("viento_km_h"),
                    ubicacion=self.location_name,
                    latitud=self.latitud,
                    longitud=self.longitud,
                    fuente="AEMET",
                )
            )
            inserted += 1

        db.commit()
        return {
            "status": "success",
            "modo": mode,
            "registros_insertados": inserted,
            "registros_actualizados": updated,
            "timestamp": utc_now().isoformat(),
        }

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _average(*values: float | None) -> float | None:
        usable = [value for value in values if value is not None]
        return round(sum(usable) / len(usable), 2) if usable else None

    def _max_period_value(self, entries: list[dict[str, Any]]) -> float | None:
        values = [self._to_float(item.get("value")) for item in entries]
        usable = [value for value in values if value is not None]
        return max(usable) if usable else None

    def _first_wind_speed(self, entries: list[dict[str, Any]]) -> float | None:
        for item in entries:
            value = self._to_float(item.get("velocidad"))
            if value is not None:
                return value
        return None


aemet_client = AemetClient()

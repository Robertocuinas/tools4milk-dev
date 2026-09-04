from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DatosMetereologicos(Base):
    __tablename__ = "datos_metereologicos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    temperatura_media: Mapped[float] = mapped_column(Float, nullable=True)
    temperatura_maxima: Mapped[float] = mapped_column(Float, nullable=True)
    temperatura_minima: Mapped[float] = mapped_column(Float, nullable=True)
    humedad_relativa: Mapped[float] = mapped_column(Float, nullable=True)
    precipitacion: Mapped[float] = mapped_column(Float, nullable=True)
    velocidad_viento: Mapped[float] = mapped_column(Float, nullable=True)
    presion_atmosferica: Mapped[float] = mapped_column(Float, nullable=True)
    estado_cielo: Mapped[str] = mapped_column(String(120), nullable=True)
    ubicacion: Mapped[str] = mapped_column(String(160), default="Villalba, Lugo")
    latitud: Mapped[float] = mapped_column(Float, nullable=True)
    longitud: Mapped[float] = mapped_column(Float, nullable=True)
    fuente: Mapped[str] = mapped_column(String(80), nullable=True)

    @property
    def es_lluvia(self) -> bool:
        return (self.precipitacion or 0) > 0

    @property
    def es_dia_frio(self) -> bool:
        return self.temperatura_media is not None and self.temperatura_media < 5

    @property
    def es_dia_calido(self) -> bool:
        return self.temperatura_media is not None and self.temperatura_media > 25

    @property
    def es_viento_fuerte(self) -> bool:
        return self.velocidad_viento is not None and self.velocidad_viento > 10

    @property
    def humedad_alta(self) -> bool:
        return self.humedad_relativa is not None and self.humedad_relativa > 80

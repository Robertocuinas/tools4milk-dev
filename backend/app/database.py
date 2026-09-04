from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


database_url = settings.database_url

# Railway/Postgres suele proporcionar la URL como postgresql://...
# SQLAlchemy interpreta eso usando psycopg2 por defecto.
# Como el proyecto usa psycopg v3, forzamos el driver correcto.
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {"connect_timeout": 10}

engine = create_engine(
    database_url,
    echo=settings.database_echo,
    connect_args=connect_args,
    # pool_pre_ping descarta conexiones muertas antes de usarlas (Railway/proxies
    # cierran conexiones inactivas; tras un cambio de esquema las conexiones del
    # pool quedan invalidas). Evita errores intermitentes de "conexion cerrada".
    pool_pre_ping=True,
    # Recicla conexiones con mas de 30 min para no arrastrar sockets caducados.
    pool_recycle=1800,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

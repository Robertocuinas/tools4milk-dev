"""
Configuración y fixtures para tests de Tools4Milk MVP
"""

import pytest
import os
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["REDIS_ENABLED"] = "False"
os.environ["AEMET_API_KEY"] = ""
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.time_utils import utc_now

from app.main import app
from app.database import Base, get_db
from app.config import settings
from app.models.usuario import Usuario
from app.models.tools4milk import Animal, Empleado, Lactacion, Maquinaria, TareaCatalogo, TareaEjecucion, TratamientoActivo, Zona
from app.security import hash_password
import uuid

# Crear base de datos de prueba en memoria
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def db():
    """Proporciona una sesión de base de datos de prueba"""
    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    """Proporciona un cliente TestClient para la API"""
    Base.metadata.create_all(bind=engine)
    ensure_operational_seed()
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(db):
    """
    Crea un usuario de prueba en la base de datos

    Returns:
        Usuario con credenciales:
        - username: "testuser"
        - email: "test@example.com"
        - password: "testpass123" (hashado)
    """
    user = Usuario(
        id=uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        hashed_password=hash_password("testpass123"),
        role="admin",
        activo=True,
        debe_cambiar_contrasena=False,
        fecha_creacion=utc_now()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_user_credentials():
    """Proporciona credenciales de usuario para pruebas"""
    return {
        "username": "testuser",
        "password": "testpass123"
    }


@pytest.fixture
def test_inactive_user(db):
    """
    Crea un usuario inactivo en la base de datos

    Returns:
        Usuario inactivo con credenciales:
        - username: "inactiveuser"
        - email: "inactive@example.com"
        - password: "inactivepass123"
    """
    user = Usuario(
        id=uuid.uuid4(),
        username="inactiveuser",
        email="inactive@example.com",
        hashed_password=hash_password("inactivepass123"),
        role="operario",
        activo=False,
        debe_cambiar_contrasena=False,
        fecha_creacion=utc_now()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client):
    ensure_test_user("admin", "admin@tools4milk.local", "admin")
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "testpass123"},
    )
    assert response.status_code == 200
    token = response.json()["token"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def operario_headers(client):
    ensure_test_user("laura.fernandez", "laura.fernandez@tools4milk.local", "alimentacion")
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "laura.fernandez", "password": "testpass123"},
    )
    assert response.status_code == 200
    token = response.json()["token"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def ensure_test_user(username: str, email: str, role: str) -> None:
    db = TestingSessionLocal()
    try:
        user = db.execute(select(Usuario).where(Usuario.username == username)).scalar_one_or_none()
        password_hash = hash_password("testpass123")
        if user is None:
            db.add(
                Usuario(
                    id=uuid.uuid4(),
                    username=username,
                    email=email,
                    hashed_password=password_hash,
                    role=role,
                    activo=True,
                    debe_cambiar_contrasena=False,
                    fecha_creacion=utc_now(),
                )
            )
        else:
            user.email = email
            user.hashed_password = password_hash
            user.role = role
            user.activo = True
        db.commit()
    finally:
        db.close()


def ensure_operational_seed() -> None:
    db = TestingSessionLocal()
    try:
        animal = db.execute(select(Animal).where(Animal.crotal_oficial == "TEST-0001")).scalar_one_or_none()
        if animal is None:
            animal = Animal(
                id=uuid.uuid4(),
                crotal_oficial="TEST-0001",
                nombre="Vaca test",
                sexo="hembra",
                fecha_nacimiento=date(2021, 1, 1),
                raza="frisona",
                estado="lactante",
                estado_reproductivo="lactante",
                fecha_entrada=date(2021, 1, 1),
            )
            db.add(animal)
            db.flush()

        frontend_animal = db.execute(select(Animal).where(Animal.crotal_oficial == "animal-001")).scalar_one_or_none()
        if frontend_animal is None:
            frontend_animal = Animal(
                id=uuid.uuid4(),
                crotal_oficial="animal-001",
                nombre="Luna",
                sexo="hembra",
                fecha_nacimiento=date(2020, 4, 12),
                raza="frisona",
                estado="produccion",
                estado_reproductivo="lactante",
                fecha_entrada=date(2020, 4, 12),
            )
            db.add(frontend_animal)
            db.flush()

        lactation = db.execute(select(Lactacion).where(Lactacion.animal_id == animal.id)).scalar_one_or_none()
        if lactation is None:
            db.add(
                Lactacion(
                    id=uuid.uuid4(),
                    animal_id=animal.id,
                    numero=1,
                    fecha_parto=date(2025, 1, 1),
                    fecha_secado=None,
                    produccion_total_kg=3500,
                )
            )
        frontend_lactation = db.execute(select(Lactacion).where(Lactacion.animal_id == frontend_animal.id)).scalar_one_or_none()
        if frontend_lactation is None:
            db.add(
                Lactacion(
                    id=uuid.uuid4(),
                    animal_id=frontend_animal.id,
                    numero=3,
                    fecha_parto=date(2025, 10, 2),
                    fecha_secado=None,
                    produccion_total_kg=8071,
                )
            )
        if db.execute(select(Zona).limit(1)).scalar_one_or_none() is None:
            db.add(
                Zona(
                    id=uuid.uuid4(),
                    nombre="Sala de ordeno",
                    codigo="ORD",
                    descripcion="Produccion, calidad de leche y tanque.",
                    tiene_pantalla_tv=True,
                    tiene_tablet=True,
                )
            )
        catalog = db.execute(select(TareaCatalogo).limit(1)).scalar_one_or_none()
        if catalog is None:
            catalog = TareaCatalogo(
                id=uuid.uuid4(),
                codigo="cat-ord-001",
                nombre="Revisar tanque",
                descripcion="Revision operativa diaria",
                cualificacion_requerida="ordeno",
                duracion_estimada_min=15,
                activa=True,
            )
            db.add(catalog)
            db.flush()
        if db.execute(select(TareaEjecucion).limit(1)).scalar_one_or_none() is None:
            db.add(
                TareaEjecucion(
                    id=uuid.uuid4(),
                    catalogo_id=catalog.id,
                    estado="pendiente",
                    ts_planificada=utc_now().replace(tzinfo=None),
                    creado_en=utc_now().replace(tzinfo=None),
                )
            )
        if db.execute(select(TratamientoActivo).limit(1)).scalar_one_or_none() is None:
            db.add(
                TratamientoActivo(
                    id=uuid.uuid4(),
                    animal_id=frontend_animal.id,
                    farmaco="Suplemento mineral",
                    dosis="120 g/dia",
                    dias_tratamiento=7,
                    fecha_inicio=date(2026, 5, 20),
                    fecha_fin_prevista=date(2026, 5, 27),
                    activo=True,
                    checkboxes=[],
                )
            )
        if db.execute(select(Empleado).limit(1)).scalar_one_or_none() is None:
            db.add(
                Empleado(
                    id=uuid.uuid4(),
                    nombre="Roberto",
                    apellidos="Castro",
                    rol="admin",
                    cualificaciones=[],
                    activo=True,
                    fecha_alta=date(2020, 1, 1),
                )
            )
        if db.execute(select(Maquinaria).limit(1)).scalar_one_or_none() is None:
            db.add(
                Maquinaria(
                    id=uuid.uuid4(),
                    nombre="Robot de ordeno 1",
                    tipo="ordeno",
                    activa=True,
                    estado="operativa",
                )
            )
        db.commit()
    finally:
        db.close()

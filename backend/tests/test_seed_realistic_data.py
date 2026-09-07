"""Tests del script de seed ``seed_realistic_data.py``.

Validan la propiedad más importante del script: que es **idempotente**.
Re-ejecutarlo no debe duplicar filas ni pisar datos reales.

Los tests corren contra SQLite (lo que tenemos en CI) en lugar de
Postgres. El script no usa features específicas de Postgres más allá
de las que SQLAlchemy abstrae (UUID, DateTime con timezone, FK), así
que la verificación en SQLite es suficiente para detectar regresiones
lógicas; los detalles de tipos DDL específicos de Postgres se
validan al levantar el stack con docker-compose.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPT = BACKEND_DIR / "scripts" / "seed_realistic_data.py"


def _run_seed(db_url: str, *extra_args: str) -> subprocess.CompletedProcess:
    """Ejecuta el script de seed en un subproceso. ``db_url`` es la
    cadena de conexión que se inyecta vía ``DATABASE_URL``."""
    env = {**os.environ, "DATABASE_URL": db_url, "ENVIRONMENT": "development"}
    return subprocess.run(
        [sys.executable, str(SCRIPT), *extra_args],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


def _count(db, model) -> int:
    return db.execute(select(func.count()).select_from(model)).scalar_one()


def _make_session(db_url: str):
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    return Session


class TestSeedRealisticData:
    def test_seed_crea_datos_en_tabla_vacia(self, tmp_path):
        """En una BD vacía, el seed crea animales, lactaciones, alertas,
        incidencias, etc. Verificamos que las tablas de dominio tienen
        filas tras la primera ejecución.

        Notas sobre lo que NO comprobamos:
        - ``zonas``, ``maquinaria``, ``tareas_catalogo``: las siembra la
          migración baseline (0002b), no el script.
        - ``tareas_ejecuciones``: depende de que ``tareas_catalogo``
          tenga filas, lo cual solo pasa tras aplicar las migraciones.
          En docker-compose el flujo es apply_migrations → seed; en
          SQLite sin migraciones queda vacío.
        """
        db_path = tmp_path / "seed_test.db"
        db_url = f"sqlite:///{db_path}"
        r = _run_seed(db_url)
        assert r.returncode == 0, f"Seed falló: {r.stderr}\n{r.stdout}"

        from app.models.tools4milk import (
            Alerta, Animal, Empleado, Incidencia, Lactacion,
            Pedido, Turno,
        )
        with _make_session(db_url)() as db:
            for cls, min_count in [
                (Animal, 5),
                (Lactacion, 5),
                (Empleado, 3),
                (Alerta, 1),
                (Incidencia, 1),
                (Turno, 1),
                (Pedido, 1),
            ]:
                count = _count(db, cls)
                assert count >= min_count, (
                    f"{cls.__name__} solo tiene {count} filas tras el seed "
                    f"(esperaba >= {min_count})"
                )

    def test_seed_es_idempotente(self, tmp_path):
        """Re-ejecutar el seed no debe crear filas duplicadas. Esta es
        la propiedad más crítica: si no se cumpliera, levantar el
        stack dos veces duplicaría todos los datos de demo."""
        db_path = tmp_path / "seed_idem.db"
        db_url = f"sqlite:///{db_path}"

        r1 = _run_seed(db_url)
        assert r1.returncode == 0, f"1er seed falló: {r1.stderr}"

        from app.models.tools4milk import (
            Alerta, Animal, Incidencia, TareaEjecucion,
        )
        with _make_session(db_url)() as db:
            animales_1 = _count(db, Animal)
            alertas_1 = _count(db, Alerta)
            incidencias_1 = _count(db, Incidencia)
            tareas_1 = _count(db, TareaEjecucion)
            assert animales_1 > 0, "1er seed no creó animales"

        r2 = _run_seed(db_url)
        assert r2.returncode == 0, f"2º seed falló: {r2.stderr}\n{r2.stdout}"

        with _make_session(db_url)() as db:
            for cls, before in [
                (Animal, animales_1),
                (Alerta, alertas_1),
                (Incidencia, incidencias_1),
                (TareaEjecucion, tareas_1),
            ]:
                after = _count(db, cls)
                assert after == before, (
                    f"{cls.__name__}: 1er seed={before}, tras 2º={after} "
                    f"(debería ser igual — el script no es idempotente)"
                )

    def test_seed_status_no_crea_datos(self, tmp_path):
        """``--status`` muestra recuentos pero no siembra. Verificamos
        que una BD vacía sigue vacía tras ejecutarlo."""
        db_path = tmp_path / "seed_status.db"
        db_url = f"sqlite:///{db_path}"

        r = _run_seed(db_url, "--status")
        assert r.returncode == 0, f"--status falló: {r.stderr}\n{r.stdout}"

        from app.models.tools4milk import Animal, Alerta
        with _make_session(db_url)() as db:
            assert _count(db, Animal) == 0, (
                "--status creó animales; debería ser read-only"
            )
            assert _count(db, Alerta) == 0, (
                "--status creó alertas; debería ser read-only"
            )

    def test_seed_no_requiere_migraciones_previas(self, tmp_path):
        """El script debe poder correr contra una BD completamente
        vacía (sin migraciones aplicadas). El flag --no-create-all
        permite desactivarlo para CI estricto, pero el comportamiento
        por defecto es crear el schema via SQLAlchemy."""
        db_path = tmp_path / "seed_fresh.db"
        db_url = f"sqlite:///{db_path}"

        # BD recién creada, sin tablas.
        r = _run_seed(db_url)
        assert r.returncode == 0, (
            f"El seed no debería requerir migraciones previas: {r.stderr}\n{r.stdout}"
        )

        from app.models.tools4milk import Animal
        with _make_session(db_url)() as db:
            assert _count(db, Animal) > 0

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import settings  # noqa: E402


MIGRATIONS_DIR = ROOT / "migrations"
INIT_SQL_PATH = ROOT.parent / "database" / "init.sql"
MIGRATION_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)
"""


def split_sql(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        current.append(line)
        if stripped.endswith(";"):
            statement = "\n".join(current).strip().rstrip(";")
            if statement:
                statements.append(statement)
            current = []
    tail = "\n".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def sqlite_compatible_statement(statement: str, connection) -> str | None:
    match = re.match(r"ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+) (.+)", statement, re.IGNORECASE | re.DOTALL)
    if match is None:
        return statement

    table, column, definition = match.groups()
    existing_columns = {item["name"] for item in inspect(connection).get_columns(table)}
    if column in existing_columns:
        return None
    return f"ALTER TABLE {table} ADD COLUMN {column} {definition}"


def load_migrations() -> list[Path]:
    return sorted(path for path in MIGRATIONS_DIR.glob("*.sql") if path.name[0].isdigit())


def _engine_url() -> str:
    # Railway/Postgres entrega la URL como postgresql://...; SQLAlchemy usaria psycopg2
    # por defecto, pero el proyecto usa psycopg v3. Forzamos el driver correcto (igual
    # que app/database.py) para que las migraciones funcionen en Railway.
    url = settings.database_url
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def _filter_init_sql_for_postgres(init_sql_text: str) -> str:
    """Strip statements that are unsafe to replay on a Postgres that already
    has the schema (e.g. CREATE TYPE / CREATE TABLE without IF NOT EXISTS).

    La migración baseline 0002b ya crea cada tabla, tipo e índice de forma
    idempotente. init.sql además define vistas, la función de auditoría y los
    triggers — eso es lo que re-ejecutamos aquí.
    """
    anchor = "-- AUDIT LOG"
    if anchor in init_sql_text:
        return init_sql_text[init_sql_text.index(anchor):]
    return init_sql_text


_TRIGGER_RE = re.compile(
    r"^CREATE\s+TRIGGER\s+(?P<name>\w+)\b",
    re.IGNORECASE,
)
_TRIGGER_TABLE_RE = re.compile(r"\bON\s+(?P<table>\w+)\b", re.IGNORECASE)


def _make_create_trigger_idempotent(statements: list[str]) -> list[str]:
    """Rewrite ``CREATE TRIGGER name ... ON table`` as
    ``DROP TRIGGER IF EXISTS name ON table; CREATE TRIGGER name ... ON table``
    para que re-ejecuciones no fallen con "trigger already exists".
    """
    rewritten: list[str] = []
    for statement in statements:
        first_line = statement.strip().splitlines()[0] if statement.strip() else ""
        match = _TRIGGER_RE.match(first_line)
        if not match:
            rewritten.append(statement)
            continue
        trigger_name = match.group("name")
        table_match = _TRIGGER_TABLE_RE.search(statement)
        if not table_match:
            rewritten.append(statement)
            continue
        table = table_match.group("table")
        drop_stmt = f"DROP TRIGGER IF EXISTS {trigger_name} ON {table}"
        rewritten.append(drop_stmt)
        rewritten.append(statement)
    return rewritten


def apply_migrations(dry_run: bool = False) -> None:
    engine = create_engine(_engine_url())
    migrations = load_migrations()
    if not migrations:
        print("No migrations found.")
        return

    is_sqlite = engine.dialect.name == "sqlite"
    init_sql_text = INIT_SQL_PATH.read_text(encoding="utf-8") if INIT_SQL_PATH.exists() else None

    with engine.begin() as connection:
        tables = set(inspect(connection).get_table_names())
        if dry_run and "schema_migrations" not in tables:
            applied = set()
        else:
            connection.execute(text(MIGRATION_TABLE_SQL))
            applied = {
                row[0]
                for row in connection.execute(text("SELECT version FROM schema_migrations")).all()
            }

        # 1) Apply every numbered migration in migrations/ (idempotent).
        for path in migrations:
            version = path.name
            if version in applied:
                print(f"SKIP {version}")
                continue

            print(f"APPLY {version}")
            statements = split_sql(path.read_text(encoding="utf-8"))
            if dry_run:
                for statement in statements:
                    print(f"  {statement.splitlines()[0]}")
                continue

            for statement in statements:
                if is_sqlite:
                    statement = sqlite_compatible_statement(statement, connection)
                    if statement is None:
                        continue
                # exec_driver_sql evita el parseo de bind params de SQLAlchemy, necesario
                # para sentencias con casts (::tipo), asignaciones plpgsql (:=) y bloques $$.
                # Las migraciones no llevan parámetros, así que escapamos los '%' literales
                # (p. ej. '5%') a '%%' para que psycopg no los trate como placeholders.
                connection.exec_driver_sql(statement.replace("%", "%%"))

            connection.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:version)"),
                {"version": version},
            )

        # 2) After the baseline, replay the views + audit triggers from init.sql
        #    on PostgreSQL. init.sql ships CREATE TRIGGER statements that are
        #    NOT idempotent, so we rewrite them into DROP TRIGGER IF EXISTS +
        #    CREATE TRIGGER pairs. CREATE OR REPLACE covers the function and
        #    views, and the remaining DDL is already idempotent.
        if init_sql_text and not is_sqlite:
            audit_version = "init_sql_views_audit"
            if audit_version not in applied:
                print(f"APPLY {audit_version}")
                tail_sql = _filter_init_sql_for_postgres(init_sql_text)
                statements = _make_create_trigger_idempotent(split_sql(tail_sql))
                if dry_run:
                    for statement in statements:
                        first_line = statement.splitlines()[0] if statement.splitlines() else statement[:80]
                        print(f"  {first_line}")
                else:
                    for statement in statements:
                        connection.exec_driver_sql(statement.replace("%", "%%"))
                connection.execute(
                    text("INSERT INTO schema_migrations (version) VALUES (:version)"),
                    {"version": audit_version},
                )


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply Tools4Milk SQL migrations.")
    parser.add_argument("--dry-run", action="store_true", help="Print pending migrations without applying them.")
    args = parser.parse_args()
    apply_migrations(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
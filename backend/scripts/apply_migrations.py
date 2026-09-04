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


def apply_migrations(dry_run: bool = False) -> None:
    engine = create_engine(_engine_url())
    migrations = load_migrations()
    if not migrations:
        print("No migrations found.")
        return

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
                if engine.dialect.name == "sqlite":
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply Tools4Milk SQL migrations.")
    parser.add_argument("--dry-run", action="store_true", help="Print pending migrations without applying them.")
    args = parser.parse_args()
    apply_migrations(dry_run=args.dry_run)


if __name__ == "__main__":
    main()

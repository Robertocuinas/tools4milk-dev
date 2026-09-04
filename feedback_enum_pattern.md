---
name: enum-postgresql-pattern
description: Patrón para mapear enums PostgreSQL en SQLAlchemy ORM
metadata:
  type: feedback
---

## Pattern for PostgreSQL Native Enums in SQLAlchemy

**Rule:** When a field in PostgreSQL is defined as a native ENUM type, the SQLAlchemy ORM model MUST:
1. Import or create a Python Enum class in `app/enums.py` that matches the PostgreSQL ENUM values
2. Use `Enum(PythonEnum, name="pg_enum_name", values_callable=lambda x: [e.value for e in x]).with_variant(String(...), "sqlite")`
3. Use the Python enum in comparisons, not string literals
4. Map string inputs via repository helper functions (e.g., `_map_enum()`)

**Why:** PostgreSQL rejects comparisons between ENUM types and VARCHAR. If the ORM sends a VARCHAR instead of the native ENUM, the database returns "operator does not exist" error (500).

**How to apply:**

For each PostgreSQL ENUM discovered:
1. Find the CREATE TYPE definition in `database/init.sql`
2. Extract the values: `CREATE TYPE foo AS ENUM ('val1', 'val2', ...)`
3. Create Python enum: 
   ```python
   class Foo(str, Enum):
       VAL1 = "val1"
       VAL2 = "val2"
   ```
4. Update model field:
   ```python
   field: Mapped[Foo] = mapped_column(
       Enum(Foo, name="foo_enum", values_callable=lambda x: [e.value for e in x])
       .with_variant(String(20), "sqlite"),
       nullable=False,
   )
   ```
5. Create `_map_field()` in repository to convert string inputs to enum
6. Use enum in all comparisons: `Model.field == Enum.VALUE`

**Examples applied:**
- `TareaEjecucion.estado` → `EstadoTarea` enum (estado_tarea PostgreSQL type)
- `Animal.estado` → `EstadoAnimal` enum (estado_animal PostgreSQL type)
- `Alerta.nivel` → `NivelAlerta` enum (nivel_alerta PostgreSQL type)

**Enums already defined in codebase:**
- `EstadoTarea` (pendiente, en_curso, completada, vencida, cancelada)
- `EstadoAnimal` (produccion, seca, recria, gestante, baja)
- `EstadoPedido` (solicitado, aprobado, en_transito, recibido, cancelado)
- `EstadoIncidencia` (abierta, en_gestion, resuelta, cerrada)
- `NivelAlerta` (baja, media, alta)

**Watch for:** Missing enums that still use String types but should use native PostgreSQL enums - search for `@sqlite` CREATE TYPE definitions in init.sql that aren't mapped to Python enums yet.


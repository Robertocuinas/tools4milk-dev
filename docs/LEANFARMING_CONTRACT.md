# Contrato LeanFarming Release 1

## Vocabulario canónico

- Estados de tarea: `pendiente -> en_curso -> verificacion -> completada`.
- Se permite volver de `en_curso` a `pendiente` y de `verificacion` a `en_curso` para corrección.
- `vencida`, `cancelada`, `programada`, `retrasada` y `ejecutada` son aliases de compatibilidad de lectura/escritura temporal; se normalizan a los cuatro estados canónicos y no aparecen como `estado_canonico`.
- Turnos: exclusivamente `manana` y `tarde`.
- Prioridad: entero 1–5. Duración estimada > 0; duración real >= 0.

Las mutaciones inválidas responden `422`. La UI puede seguir leyendo `estado` durante la migración, pero los clientes nuevos deben usar `estado_canonico`.

## Persistencia

`tareas_ejecuciones` conserva zona, empleado, turno, prioridad, duraciones, timestamps y notas. `synthetic_provenance` registra una fila por entidad materializada con `source=synthetic/generated`, versión, escenario, semilla, timestamps y payload original. La restricción `(entity_type, entity_id)` hace la carga idempotente.

## Adaptador sintético

`app.synthetic_loader.load_base(db, dataset)` carga únicamente maestros: zonas, empleados y catálogo. `materialize_events(db, dataset)` carga eventos: turnos, asignaciones y ejecuciones. `load_dataset` compone ambas fases en ese orden; no implementa scheduler ni decide disponibilidad.

El generador Release 1 no incluye asignaciones explícitas. Para demo, el adaptador usa un reparto round-robin determinista por posición de turno y lo marca como provenance; esto no es autoasignación productiva.

## API y compatibilidad

La API canónica permanece bajo `/api/v1`: `/tasks`, `/turnos` y `/asignaciones-turno`. TV solo consume GET; las mutaciones siguen protegidas por los roles existentes. La migración `0010_leanfarming_contract.sql` añade la columna `verificacion`, campos de ejecución y provenance sin eliminar columnas legacy.

## Ejecución temporal

La materialización de tareas usa `planned_at` del dataset como `ts_planificada`; no intenta generar futuras ocurrencias de recurrencias. Las recurrencias maestras existentes (`tareas_recurrentes`) quedan preparadas para el scheduler siguiente.

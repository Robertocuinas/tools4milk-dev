# Release 4 — Tendencia de calidad sintética

## Alcance R4-1

La pantalla `Calidad de leche` incorpora una serie temporal descriptiva por
animal. Los datos son exclusivamente ficticios y se identifican de forma visible
como `synthetic/generated`. No se interpola, extrapola ni presenta ninguna
recomendación clínica o productiva.

## Contrato API

`GET /api/v1/animals/{animal_id}/readings`

- Requiere autenticación y uno de los roles de lectura de calidad: `admin`,
  `veterinario`, `operario` o `alimentacion`.
- `days`: ventana retrospectiva, entre 1 y 90; valor por defecto 30.
- `limit`: máximo de lecturas, entre 1 y 180; valor por defecto 90.
- Devuelve las lecturas más recientes dentro de la ventana, ordenadas de forma
  ascendente y estable por `ts` y `robot_id`.
- Métricas disponibles en `lecturas_robot_ordeno`: `produccion_kg`, `scc`,
  `conductividad`, `flujo_max` y `duracion_min`. Grasa y proteína permanecen en
  el resumen de lactación porque la tabla diaria no contiene esas columnas.
- Un animal inexistente devuelve 404; parámetros fuera de rango devuelven 422.
- Un animal sin lecturas devuelve `count: 0` y `readings: []`; nunca se fabrican
  puntos para completar el gráfico.
- Cada respuesta incluye provenance canónica: `generated`, modo `synthetic`.

El snapshot ejecutable de OpenAPI se valida en
`backend/tests/test_openapi_docs.py`, incluido el modelo de respuesta, ejemplos,
parámetros acotados y errores 404/422.

## Datos de demostración

El generador canónico `backend/app/synthetic_data.py` produce 30 lecturas diarias
por animal mediante UUID5 derivados de `generator_version + seed + scenario +
clave lógica`. Cada lectura conserva provenance completa. Los escenarios
`normal`, `health_alert` y `degraded_quality` son reproducibles; los dos últimos
alteran descriptivamente la serie para verificar estados de demostración, sin
claims científicos.

El seed ORM manual `backend/scripts/seed_realistic_data.py` completa
`lecturas_robot_ordeno` cuando la tabla está vacía y existe al menos un robot de
ordeño. Es idempotente, usa RNG con semilla fija y nunca se ejecuta
automáticamente en producción. Todo el script se declara como demo sintética y
ficticia; ya no afirma que sus filas sean datos reales o «no demo».

## Interfaz

El panel permite elegir animal y alternar entre producción diaria y células
somáticas. Incluye estados accesibles de carga, error con reintento y `Sin datos
suficientes`. El selector y el gráfico son responsive; la provenance y la
limitación descriptiva permanecen visibles.

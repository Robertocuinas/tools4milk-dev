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

## Alcance R4-3

La pantalla `Predicciones` expone los cuatro recorridos DSS con etiquetas
honestas: tres vistas granulares sobre los endpoints existentes
(`/predictions/production/{id}`, `/predictions/composition/{id}`,
`/predictions/health-risk/{id}`) más la vista compuesta (`/predictions/{id}`),
y una pestaña de asociación meteorológica
(`GET /api/v1/weather/correlation/impact`). Las heurísticas conservan el
banner experimental («heurística aritmética, no ML»); la composición sigue
siendo un placeholder (0 → «n/d») declarado en la UI.

## Contrato API (R4-3)

`GET /api/v1/weather/correlation/impact`

- Requiere autenticación y la política de lectura existente (`admin`,
  `veterinario`, `operario` o `alimentacion`); sin ampliar privilegios.
  `POST /weather/sync` continúa solo `admin`.
- `dias_adelante` (1–30, por defecto 7) se conserva por compatibilidad como
  horizonte orientativo: no se predicen impactos. `ventana_dias` (1–90, por
  defecto 30) acota la ventana retrospectiva del análisis.
- Estadística exclusivamente descriptiva y determinista sobre observaciones
  sintéticas existentes: medias diarias emparejadas por fecha natural de
  `lecturas_meteorologia` (temperatura, humedad) y `lecturas_robot_ordeno`
  (producción). Sin AEMET obligatorio, sin proveedores externos, sin tablas
  nuevas.
- Método `pearson_descriptivo`, fórmula
  `r = Σ((x - mx)(y - my)) / sqrt(Σ(x - mx)² · Σ(y - my)²)`, con `n` = días
  naturales emparejados. Umbral mínimo `min_sample_size = 5`; por debajo se
  devuelve `status = "insufficient_data"` con `asociaciones = []`. Nunca se
  inventan resultados.
- La clave legacy `impactos_predichos` se conserva vacía para compatibilidad.
- Cada respuesta incluye el aviso visible
  «Asociación descriptiva sobre datos sintéticos; no implica causalidad ni
  validez predictiva, clínica o productiva» y provenance canónica
  (`generated`/`aemet_real`, modo `synthetic`/`real`).
- RBAC de predicciones sin cambios: `admin`, `veterinario` y `alimentacion`
  (200); `operario` recibe 403 con «No tienes permisos para realizar esta
  accion».

El snapshot ejecutable de OpenAPI se valida en
`backend/tests/test_openapi_docs.py` (`operationId = weather_correlation_impact`,
ejemplos sufficient/insufficient, parámetros acotados). Los recorridos de UI se
cubren en `frontend/playwright/release4-correlation.spec.ts` con datos
sintéticos mocados.

## Alcance R4-2

La ruta `/alerts` muestra el listado y estado de las alertas sintéticas, con
filtros de estado/severidad y estados de carga, error, vacío y desconexión. La
resolución exige confirmación explícita y solo se muestra a los roles con la
capability `resolve_alert` (`admin` y `veterinario`). La vista TV continúa
siendo estrictamente de solo lectura.

### Contrato de resolución

`PATCH /api/v1/alerts/{alert_id}`

- Requiere autenticación y la política clínica existente: `admin` o
  `veterinario`; los demás roles reciben 403.
- Exige `X-Operation-Id` UUID y `expected_version` positivo.
- Devuelve `operation_id`, `replayed` y la alerta versionada resultante.
- La repetición del mismo actor, operation id y payload devuelve la respuesta
  almacenada sin aplicar de nuevo la mutación.
- Reutilizar el operation id con otro payload o enviar una versión obsoleta
  devuelve 409. La versión actual permanece incluida en el conflicto.
- El cliente conserva el operation id mientras el diálogo de confirmación siga
  abierto y no guarda tokens ni identidad en IndexedDB, localStorage o cachés.

La migración `0013_alert_resolution_version.sql` añade el versionado optimista.
Los contratos de autorización, idempotencia, conflicto y OpenAPI se cubren en
`backend/tests/test_alert_resolution.py`; el recorrido accesible, el control
oculto sin capability y TV read-only se cubren en
`frontend/playwright/release4-alert-resolution.spec.ts`.

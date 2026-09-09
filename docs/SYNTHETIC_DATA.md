# Datos sintéticos Release 1

El generador `backend/app/synthetic_data.py` crea un documento JSON portable,
separado del seed ORM histórico `seed_realistic_data.py`. No contiene datos reales,
PII ni afirmaciones sobre explotaciones concretas.

Contrato

- `generator_version`, `scenario_id`, `random_seed`, `generated_at` y
  `simulation_time` están en `manifest` y en cada registro mediante `provenance`.
- El origen canónico es `synthetic/generated`. `aemet_real` queda reservado para
  una integración externa opt-in; `aemet_failure` usa fallback sintético.
- UUID5 se deriva de versión, seed, escenario, entidad y clave lógica. La misma
  versión+seed+escenario reproduce el dataset lógico, aunque cambie `generated_at`.
- Las distribuciones son ilustrativas y no están validadas científicamente.

Perfiles: `small` (8 animales), `demo` (200 animales, 30 días y turnos manana/tarde)
y `load` (1000 animales para volumen, no capacidad productiva). Cada perfil
incluye 30 lecturas diarias de robot por animal (`milk_readings`), con UUID5,
seed y provenance reproducibles; producción y células somáticas son valores
ilustrativos, no mediciones ni recomendaciones clínicas.

Escenarios: `normal`, `delayed_tasks`, `critical_machinery`, `health_alert`,
`seasonal_variation`, `degraded_quality`, `aemet_failure`,
`degraded_connectivity` e `incomplete_data`.

`incomplete_data` introduce intencionadamente ausencias para probar que DQ las
detecta; los demás escenarios pasan DQ.

Uso desde `backend`:

    python scripts/generate_synthetic.py --profile demo --scenario normal --output artifacts/demo.json --check
    python scripts/generate_synthetic.py --profile small --scenario health_alert --seed 7 --check
    python scripts/generate_synthetic.py --reset --output artifacts/demo.json

El seed no se ejecuta durante el arranque ni contra producción. `quality_report`
comprueba manifiesto, provenance, unicidad, referencias y rangos; con `--check`
el CLI devuelve código 1 si falla.

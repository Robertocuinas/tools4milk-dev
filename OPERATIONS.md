# Operations — Tools4Milk

Guía de despliegue, operación y mantenimiento. El README.md general
describe el producto; este doc asume que ya entiendes qué hace la app
y se centra en **cómo correrla en otro servidor sin sorpresas**.

---

## 1. Despliegue local con Docker Compose

### Requisitos

- **Docker Desktop** instalado y corriendo (la app usa `docker compose`,
  no `docker-compose` v1).
- Al menos 4 GB de RAM libres (Postgres + backend + frontend + nginx).
- Puertos `80`, `3000`, `5432`, `8000` libres en el host.

### Pasos

```bash
# 1. Clonar
git clone https://github.com/Robertocuinas/tools4milk-dev.git
cd tools4milk-dev

# 2. Configurar el entorno demo (explícito y solo local)
cat > .env <<'EOF'
ENVIRONMENT=development
SECRET_KEY=$(openssl rand -base64 48)   # ⚠ cambia esto en producción
INITIAL_DEMO_PASSWORD=testpass123      # déjalo vacío en producción
AEMET_API_KEY=                          # opcional: tu API key de AEMET OpenData
EOF

# 3. Levantar el stack limpio
#    - Postgres espera a estar healthy
#    - Backend aplica migraciones (0000..0009) y, solo con configuración demo, siembra usuarios
#    - Frontend espera al backend
#    - Nginx enruta solo cuando frontend Y backend están healthy
docker compose up -d --build

# 4. Verificar que todo está en pie
docker compose ps
# Todos los servicios deben estar en estado "healthy" o "running".

docker compose logs -f backend | head -30
# Debe terminar con "Application startup complete" y un "Uvicorn running on
# http://0.0.0.0:8000".
```

### URLs por defecto

- **Frontend (Nginx)**: http://localhost
- **Backend FastAPI**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **Postgres**: `localhost:5432` (interno a la red Docker como `db:5432`)

### Resetear todo a cero (BD limpia)

Si quieres empezar desde una BD vacía:

```bash
docker compose down -v     # ⚠ BORRA todos los datos
docker compose up -d --build
```

El `-v` borra el volumen `postgres_data`. La próxima vez que arranque,
`docker-entrypoint-initdb.d/init.sql` creará el schema base y el backend
aplicará las migraciones numeradas. Los usuarios demo solo se crean si
`ENVIRONMENT=development` (o `demo`/`test`) y `INITIAL_DEMO_PASSWORD` no está vacío.

### Poblar con datos de demo

Con `ENVIRONMENT=development` y `INITIAL_DEMO_PASSWORD` no vacío, el backend
crea 5 usuarios demo en el primer arranque (ver §5); las tablas
de dominio (animales, lactaciones, alertas…) arrancan vacías. Para
poblar la BD con datos de ejemplo, ejecuta el seed manual:

```bash
docker compose exec backend python scripts/seed_realistic_data.py
```

El script es idempotente: si los datos demo ya existen, no los duplica.
Si quieres sembrar también turnos y asignaciones de la semana en
curso, ejecuta además:

```bash
docker compose exec backend python scripts/populate_shifts.py \
    --base-url http://localhost:8000 \
    --username admin \
    --password testpass123 \
    --days 7
```

### Verificar end-to-end que la BD tiene datos

```bash
# 1. ¿Hay animales?
docker compose exec db psql -U postgres -d tools4milk \
    -c "SELECT count(*) FROM animales;"

# 2. ¿Login funciona?
curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"testpass123"}' \
    -i | head -10
# Debe devolver 200 + Set-Cookie: t4m_token=...; HttpOnly; ...

# 3. ¿El dashboard devuelve KPIs reales (no cero)?
#    (con la cookie del paso 2)
curl -s http://localhost:8000/api/v1/dashboard/summary \
    --cookie "t4m_token=..." | python -m json.tool
```

---

## 2. Variables de entorno (backend)

Las mínimas para producción:

| Variable | Ejemplo | Notas |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://t4m:***@db:5432/tools4milk` | Cadena SQLAlchemy. **Cambiar de SQLite en prod.** |
| `SECRET_KEY` | `openssl rand -base64 48` | **Crítico.** Mínimo 32 chars. Si cambia, todos los tokens emitidos quedan invalidados. |
| `ENVIRONMENT` | `production` | Activa validaciones duras en startup + HSTS + cookie `Secure`. |
| `CORS_ORIGINS` | `https://granja.example.com` | Lista separada por comas. **Nunca** dejar `*` en prod. |
| `AEMET_API_KEY` | (opcional) | API key de AEMET OpenData. Si falta, el módulo `weather` usa datos sintéticos. |
| `INITIAL_DEMO_PASSWORD` | (vacío en prod) | Contraseña inicial de los 5 usuarios demo. Solo se procesa en `development`, `demo` o `test`; **vacía en prod** y producción rechaza cualquier valor. |
| `LOGIN_RATE_LIMIT_MAX` | `5` | Intentos por ventana (default 5). |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `60` | Ventana de rate limit (default 60s). |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | TTL del refresh token. |
| `REFRESH_TOKEN_MAX_PER_USER` | `5` | Máximo de refresh activos por usuario. |

> **Genera `SECRET_KEY` con `openssl rand -base64 48` (48 bytes
> base64-encoded ≈ 64 chars). Cualquier valor por debajo de 32 chars
> hará que el servidor rechace arrancar en producción.**

---

## 3. Aplicar migraciones

El entrypoint de docker-compose ya corre `apply_migrations.py` antes
de levantar uvicorn. Si lo haces fuera de Docker (p.ej. contra un
Postgres gestionado), correlo manualmente:

```bash
cd backend
python scripts/apply_migrations.py
```

- Idempotente: puede re-ejecutarse sin romper (cada migración tiene
  un `CREATE TABLE IF NOT EXISTS` o equivalente).
- El script también reaplica `database/init.sql` con las vistas
  (`v_produccion_diaria`, etc.) y los triggers de auditoría.
- Migraciones nuevas se numeran secuencialmente: `0010_xxx.sql`.
  Ordénalas por nombre — el script las aplica lexicográficamente.

---

## 4. Rotar `SECRET_KEY` (compromiso o caducidad)

Si `SECRET_KEY` se filtra o quieres rotar periódicamente:

1. Genera el nuevo valor y añádelo como `SECRET_KEY_NEW` en `.env`
   **sin tocar** el `SECRET_KEY` actual.
2. Reinicia el backend. **No** hay un flujo de doble-llave todavía —
   todos los tokens emitidos con la llave vieja se invalidan al
   reiniciar. Los usuarios tendrán que volver a hacer login.
3. Una vez confirmado que todos re-loguean, borra `SECRET_KEY_NEW` y
   actualiza `SECRET_KEY` directamente para futuros deploys.

Para una rotación sin downtime habría que implementar un sistema de
dos llaves activas simultáneas (overlap window). **No implementado** —
el logout forzado es aceptable para esta app interna.

---

## 5. Usuarios demo

`backend/app/main.py::seed_demo_user` crea 5 usuarios al arrancar solo
en `development`, `demo` o `test`, y únicamente cuando
`INITIAL_DEMO_PASSWORD` está definida y no vacía:

| Username | Rol | Uso |
|---|---|---|
| `admin` | admin | Acceso total, gestión de usuarios. |
| `roberto.castro` | admin | Cuenta personal del autor. |
| `operario.zona` | operario | Tablet de zona — tareas, partes. |
| `laura.fernandez` | alimentacion | Raciones, carro mezclador. |
| `dr.mendez` | veterinario | Eventos sanitarios, tratamientos. |

Todos con `INITIAL_DEMO_PASSWORD` y `debe_cambiar_contrasena=False`.

**En producción**: `ENVIRONMENT=production` rechaza el arranque si
`INITIAL_DEMO_PASSWORD` no está vacía y nunca ejecuta el seed. Crea los
usuarios reales mediante un procedimiento administrativo fuera de este
seed; no reutilices las credenciales demo.

---

## 6. Logs y monitoring

- El backend loguea a stdout en formato `LEVEL: logger - mensaje`.
  En Docker, `docker compose logs -f backend`.
- Health check para un balanceador: `GET /health` (200 si la app y
  la DB responden). **No** `/health/db` — ese es para diagnóstico
  manual porque ejecuta queries reales.
- `/api/v1/audit-log` lista las últimas 100 acciones de los usuarios
  (crear animal, cambiar alerta, login, …). Útil para incidentes.

---

## 7. Backups

La base de datos es la única pieza con estado. Recomendado:

```bash
# Backup diario completo
docker compose exec -T db pg_dump -U t4m tools4milk | gzip > /backups/tools4milk-$(date +%F).sql.gz

# Restaurar
gunzip -c /backups/tools4milk-XXXX-XX-XX.sql.gz | docker compose exec -T db psql -U t4m -d tools4milk
```

Los JWT (access + refresh) emitidos antes del restore dejarán de ser
válidos al rotar `SECRET_KEY`. Sin rotación, los access tokens
siguen siendo válidos hasta su expiración natural (8h) — considera
rotar `SECRET_KEY` tras un restore para forzar re-login.

---

## 8. Troubleshooting

**"Cannot connect to database" al arrancar.**
- Verifica `DATABASE_URL` y que el host de Postgres sea alcanzable.
- En Docker, el host es el nombre del servicio (`db`), no `localhost`.

**"SECRET_KEY must be changed before running in production".**
- El servidor arrancó con `ENVIRONMENT=production` y la SECRET_KEY
  por defecto o demasiado corta. Genera una nueva con
  `openssl rand -base64 48`.

**"CORS_ORIGINS must be explicit before running in production".**
- `CORS_ORIGINS=*` o no definida. Pon los orígenes exactos separados
  por comas: `CORS_ORIGINS=https://granja.example.com,https://tv.granja.local`.

**El frontend se ve pero `/api/v1/auth/login` devuelve 401.**
- El navegador NO está mandando la cookie. Verifica:
  1. `NEXT_PUBLIC_API_URL` apunta al backend correcto.
  2. `CORS_ORIGINS` del backend incluye el origen del frontend.
  3. Si frontend y backend están en dominios distintos, ambos deben
     tener HTTPS (la cookie lleva `SameSite=Lax` y `Secure` en prod).

**Las predicciones son heurísticas experimentales, no ML.**
- Las respuestas incluyen `method=heuristic_arithmetic`, `validated=false` y limitaciones explícitas.
- No se muestra una confianza calibrada ni deben interpretarse como recomendación clínica o productiva.
- La evaluación sintética no equivale a validación en campo.
- El servicio de predicciones combina historial del animal + meteo.
  Sin datos de lactación activa, la estimación se degrada (ver
  el banner de `/predictions`). No es un bug, es el modelo.

---

## 9. Actualizar a una versión nueva

```bash
git pull origin main
docker compose pull              # baja imágenes nuevas si hay
docker compose up -d --build      # rebuild + reinicio
docker compose exec backend python scripts/apply_migrations.py
```

Las migraciones nuevas (R5 = `0008_datos_metereologicos.sql`,
R12 = `0009_refresh_tokens.sql`, etc.) se aplican automáticamente
si el entrypoint de docker-compose lo invoca. Si no, ejecútalo a
mano tras cada `git pull`.

---

## 10. Auditoría de cambios reciente

Las últimas tandas de remediaciones aplicadas están en el log de
git. Los prefijos siguen la convención:

- `feat:` — nueva funcionalidad (R1, R2, R3, R5, R6, R8, R9, R10,
  R11, R12, R15, R17, R18).
- `fix:` — bugfix.
- `refactor:` — cambio interno sin cambio de comportamiento.
- `test:` — solo tests.
- `chore:` — limpieza, dependencias, docs (R16, R22).

### Backlog diferido (no crítico para MVP)

- **R13 / UI de audit log** — el endpoint `GET /api/v1/audit-log` y
  la página `frontend/src/app/(app)/audit-log/page.tsx` ya están
  implementados (filtros, KPIs, expand row, AccessDenied).
- **R14 / R20 / Tests E2E con Playwright** — la cobertura actual
  (64 tests pytest, 0 lint errors, 0 tsc errors) cubre la lógica
  de negocio. Un E2E con browser real añadiría confianza marginal
  en regresiones visuales a costa de: descargar Chromium en CI
  (~150 MB), orquestar `uvicorn` + `next dev`, esperar el arranque.
  No implementado — añadir solo si se detectan regresiones de UI
  no cubiertas por unit tests.
- **Doble-llave para rotación de SECRET_KEY sin logout forzado** —
  solo si el sistema pasa a producción con usuarios activos y se
  necesita rotación de secreto sin interrupciones.

## 11. Flujo de refresh desde el frontend (R17 + R18)

El navegador del usuario lleva DOS cookies HttpOnly tras el login:

- `t4m_token` — access token de 60 min. Se adjunta en cada fetch.
- `t4m_refresh` — refresh token de 30 días. Se adjunta en cada fetch.
  Lleva `SameSite=Strict` (R22) para máxima protección CSRF.

El frontend (`lib/api.ts`) usa `credentials: "include"` en todos
los fetch, así que el navegador adjunta AMBAS cookies automáticamente.
Ningún código JavaScript tiene acceso al token (mismas garantías
anti-XSS que R8).

Hay dos mecanismos que mantienen la sesión viva sin que el usuario
tenga que hacer nada:

1. **Proactivo** — `<SessionKeeper />` (en `app/(app)/layout.tsx`)
   llama a `POST /auth/refresh` cada **50 minutos** (10 min antes de
   que el access caduque a los 60). El usuario nunca nota el corte.

2. **Reactivo** — el `request()` de `lib/api.ts` intercepta un 401
   y, salvo en endpoints de auth, llama una vez a `POST /auth/refresh`
   y reintenta la petición. Coalescing: si dos llamadas fallan con
   401 a la vez, solo se dispara un refresh; las demás esperan la
   misma promesa. Timeout: 8s.

Si el refresh falla definitivamente (reuse detection, refresh
caducado, etc.), `onSessionExpired` limpia el store y el layout
redirige a `/login`. El `proxy.ts` actúa como red de seguridad
adicional: si la cookie de access no está presente, redirige sin
necesidad de consultar al backend.

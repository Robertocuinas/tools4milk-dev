# Operations — Tools4Milk

Guía de despliegue, operación y mantenimiento. El README.md general
describe el producto; este doc asume que ya entiendes qué hace la app
y se centra en **cómo correrla en otro servidor sin sorpresas**.

---

## 1. Despliegue local con Docker Compose

```bash
# Clonar
git clone https://github.com/Robertocuinas/tools4milk-dev.git
cd tools4milk-dev

# Crear el .env del backend copiando la plantilla
cp backend/.env.example backend/.env  # si no existe, ver §2

# Levantar (Postgres + backend + frontend + nginx)
docker compose up -d
```

URLs por defecto:
- Frontend (Nginx): http://localhost
- Backend FastAPI: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- Postgres: localhost:5432 (interno a la red Docker)

El primer arranque aplica las migraciones numeradas de
`backend/migrations/` (0000…0009) y siembra 5 usuarios demo. Ver §5.

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
| `INITIAL_DEMO_PASSWORD` | (vacío en prod) | Contraseña inicial de los 5 usuarios demo. **Vacía en prod** para que el seed no se aplique. |
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

`backend/app/main.py::seed_demo_user` crea 5 usuarios la primera vez
que arranca el backend, **solo si** `INITIAL_DEMO_PASSWORD` está
definida:

| Username | Rol | Uso |
|---|---|---|
| `admin` | admin | Acceso total, gestión de usuarios. |
| `roberto.castro` | admin | Cuenta personal del autor. |
| `operario.zona` | operario | Tablet de zona — tareas, partes. |
| `laura.fernandez` | alimentacion | Raciones, carro mezclador. |
| `dr.mendez` | veterinario | Eventos sanitarios, tratamientos. |

Todos con `INITIAL_DEMO_PASSWORD` y `debe_cambiar_contrasena=False`.

**En producción**: deja `INITIAL_DEMO_PASSWORD=""` para que el seed
no se aplique. Crea los usuarios reales a través de
`POST /api/v1/auth/users` o directamente con `psql` + un hash bcrypt.

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

**Las predicciones siempre devuelven confianza baja.**
- El servicio de predicciones combina historial del animal + meteo.
  Sin datos de lactación activa, la confianza baja al mínimo (ver
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
  R11, R12, R15, R17).
- `fix:` — bugfix.
- `refactor:` — cambio interno sin cambio de comportamiento.
- `test:` — solo tests.
- `chore:` — limpieza, dependencias, docs.

## 11. Flujo de refresh desde el frontend (R17)

El navegador del usuario lleva DOS cookies HttpOnly tras el login:

- `t4m_token` — access token de 60 min. Se adjunta en cada fetch.
- `t4m_refresh` — refresh token de 30 días. Se adjunta en cada fetch.

El frontend (`lib/api.ts`) usa `credentials: "include"` en todos
los fetch, así que el navegador adjunta AMBAS cookies automáticamente.
Ningún código JavaScript tiene acceso al token (mismas garantías
anti-XSS que R8).

Para renovar la sesión cuando el access está próximo a expirar, el
frontend hace:

```ts
await fetch("/api/v1/auth/refresh", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),  // body vacío
});
```

El backend lee el refresh de la cookie (orden de prioridad: body >
cookie), lo rota, y devuelve el par nuevo en el body + re-emite
ambas cookies. El navegador sustituye automáticamente las cookies
con los valores nuevos.

Si el frontend prefiere no manejar el body vacío, también funciona
**sin body alguno** (el backend leerá solo de la cookie). Ver
`test_refresh_via_cookie_sin_body` y `test_refresh_cookie_precedencia_body`
en `backend/tests/test_autenticacion.py`.

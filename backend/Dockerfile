FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts

# Principio de mínimo privilegio (R3): el backend y el scheduler (misma
# imagen, distinto `command`) corren como usuario no-root. `useradd` existe
# en la base Debian slim; se fija ownership de /app para que migraciones
# (lectura) y runtime (imports, sin escritura salvo /tmp) funcionen.
# Evidencia: `docker exec tfm-backend whoami` -> `appuser`; si un volumen
# montado impide el arranque por permisos, el error es visible en logs y
# el healthcheck `/health` no pasa (no hay falso healthy).
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import os, urllib.request; port=os.environ.get('PORT', '8000'); urllib.request.urlopen(f'http://localhost:{port}/health', timeout=5)"

CMD sh -c "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
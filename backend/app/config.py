from pydantic_settings import BaseSettings, SettingsConfigDict


DEMO_SECRET_KEY = "tools4milk-demo-secret-change-me-please-32chars"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./tfm_mvp.db"
    database_echo: bool = False
    environment: str = "development"
    debug: bool | str = False

    # No hay secretos funcionales por defecto. La demo los proporciona de
    # forma explícita mediante .env/Compose; producción los valida al arrancar.
    secret_key: str = ""
    algorithm: str = "HS256"
    # Contrato canónico Release 3: access token de 8 h (480 min), alineado
    # con la cookie HttpOnly `t4m_token` (`AUTH_COOKIE_MAX_AGE_SECONDS`) y
    # con la documentación (README/OPERATIONS/docs/RELEASE3). El default
    # vive aquí —ningún entorno (incluida producción) depende de la variable
    # demo `ACCESS_TOKEN_EXPIRE_MINUTES` para obtenerlo; la demo solo lo
    # fija explícitamente en `.env` por claridad. El refresh no se alarga
    # (sigue en `refresh_token_expire_days`, 30 d).
    access_token_expire_minutes: int = 480

    # Refresh tokens (R12) — persistidos con estado para soportar
    # rotación y revocación. El access token es un JWT de 8 h
    # (`access_token_expire_minutes`, canónico 480); el refresh vive más
    # tiempo y se rota en cada /auth/refresh.
    refresh_token_expire_days: int = 30
    refresh_token_max_per_user: int = 5

    # Rate limiting en ``POST /auth/login`` (sliding window por IP).
    # Si se excede ``login_rate_limit_max`` intentos en
    # ``login_rate_limit_window_seconds``, el endpoint devuelve 429.
    login_rate_limit_max: int = 5
    login_rate_limit_window_seconds: int = 60

    aemet_api_key: str = ""
    aemet_municipio_id: str = "27065"
    aemet_estacion_id: str = ""

    app_url: str = "http://localhost:8000"

    initial_demo_password: str = ""

    # Vacío por defecto: el despliegue demo declara sus orígenes de forma
    # explícita y producción nunca hereda una política permisiva.
    cors_origins: list[str] | str = []


settings = Settings()

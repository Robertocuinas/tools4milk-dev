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
    access_token_expire_minutes: int = 60

    # Refresh tokens (R12) — persistidos con estado para soportar
    # rotación y revocación. El access token sigue siendo un JWT de vida
    # corta (access_token_expire_minutes); el refresh vive más tiempo y
    # se rota en cada /auth/refresh.
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

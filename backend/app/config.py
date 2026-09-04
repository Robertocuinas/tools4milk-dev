from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./tfm_mvp.db"
    database_echo: bool = False
    environment: str = "development"
    debug: bool | str = True

    secret_key: str = "tools4milk-dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    aemet_api_key: str = ""
    aemet_municipio_id: str = "27065"
    aemet_estacion_id: str = ""

    app_url: str = "http://localhost:8000"

    initial_demo_password: str = "testpass123"

    admin_secret: str = ""

    cors_origins: list[str] | str = [
        "http://localhost",
        "http://localhost:80",
        "http://localhost:3000",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
    ]


settings = Settings()

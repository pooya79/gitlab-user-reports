"""Application configuration powered by pydantic-settings."""

from functools import lru_cache
from typing import Any

from pydantic import field_validator, BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class MongoDBSettings(BaseModel):
    """MongoDB connection settings."""

    host: str = "127.0.0.1"
    port: int = 27017
    database: str = "gitlab_user_reports"
    root_username: str | None = None
    root_password: str | None = None


class Settings(BaseSettings):
    """Central application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_nested_delimiter="_", env_nested_max_split=1)

    mongodb: MongoDBSettings

    mail_username: str = "example@example.com"
    mail_password: str | None = None
    mail_from: str = "test@example.com"
    mail_from_name: str = "test"
    mail_server: str = "test.smtp.server"
    mail_port: int = 587
    mail_starttls: bool = True
    mail_ssl_tls: bool = False
    use_credentials: bool | None = None

    app_name: str = "GitLab User Reports"
    debug: bool = False
    cors_origins: str | list[str] = []
    backend_url: str = "http://localhost:8000"

    jwt_secret_key: str = "insecure-development-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_token_exp_minutes: int = 360
    require_admin_token_for_gitlab_config: bool = True

    performance_cache_expiry_seconds: int = 3600  # 1 hour

    safe_date_offset: int = (
        90  # days to add to 'until' of user performance to account for late commits
    )

    gitlab_access_level_mapping: dict[int, str] = {
        5: "Minimal Access",
        10: "Guest",
        15: "Planner",
        20: "Reporter",
        30: "Developer",
        40: "Maintainer",
        50: "Owner",
        60: "Admin",
    }

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        if isinstance(value, (list, tuple)):
            return [str(origin) for origin in value]
        return []


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached settings object."""

    return Settings()

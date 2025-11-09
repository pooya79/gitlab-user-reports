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
    app_name: str = "GitLab User Reports"
    debug: bool = False
    cors_origins: str | list[str] = []
    host: str = "127.0.0.1"
    port: int = 8000
    jwt_secret_key: str = "insecure-development-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_token_exp_minutes: int = 60
    require_admin_token_for_gitlab_config: bool = True

    safe_date_offset: int = 90 # days to add to 'until' of user performance to account for late commits

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

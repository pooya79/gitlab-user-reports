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
    uri: str | None = None

    @field_validator("uri", mode="after")
    @classmethod
    def _construct_uri(cls, value: Any, values: dict[str, Any]) -> str:
        if value:
            return value

        host = values.get("host", "127.0.0.1")
        port = values.get("port", 27017)
        database = values.get("database", "gitlab_user_reports")
        user = values.get("root_username")
        password = values.get("root_password")

        if user and password:
            return (
                f"mongodb://{user}:{password}@{host}:{port}/{database}?authSource=admin"
            )
        return f"mongodb://{host}:{port}/{database}"


class Settings(BaseSettings):
    """Central application settings loaded from environment variables."""

    mongodb: MongoDBSettings = MongoDBSettings()
    app_name: str = "GitLab User Reports"
    debug: bool = False
    cors_origins: list[str] = []
    host: str = "127.0.0.1"
    port: int = 8000
    jwt_secret_key: str = "insecure-development-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_token_exp_minutes: int = 60

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

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

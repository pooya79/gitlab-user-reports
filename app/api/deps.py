"""Shared FastAPI dependencies."""

from pymongo.database import Database

from app.core.config import Settings, get_settings
from app.db.database import get_database as _get_database


def get_mongo_database() -> Database:
    """Expose the configured MongoDB database instance."""

    return _get_database()


def get_app_settings() -> Settings:
    """Expose application settings for dependency injection."""

    return get_settings()

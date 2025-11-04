"""Shared FastAPI dependencies."""

from collections.abc import Generator

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_session


def get_db_session() -> Generator[Session, None, None]:
    """Provide a transactional database session."""

    yield from get_session()


def get_app_settings() -> Settings:
    """Expose application settings for dependency injection."""

    return get_settings()

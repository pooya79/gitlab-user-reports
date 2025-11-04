"""Database setup and session management with SQLAlchemy."""

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# Ensure the SQLite parent directory exists when using the default relative path.
if settings.database_url.startswith("sqlite"):
    database_path = settings.database_url.replace("sqlite:///", "")
    if database_path and not database_path.startswith(":memory:"):
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    echo=settings.database_echo or settings.debug,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


def get_session() -> Generator[Session, None, None]:
    """Yield a database session and handle lifecycle."""

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Create database tables for all registered models."""

    import app.models  # noqa: F401  # ensure models are imported for metadata

    Base.metadata.create_all(bind=engine)

"""FastAPI application factory and wiring."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.db.database import close_client, init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize resources such as the database before serving requests."""

    init_db()
    try:
        yield
    finally:
        close_client()


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
    docs_url="/api/docs",
)


if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router)


@app.get("/health", tags=["health"])  # pragma: no cover - trivial endpoint
async def health() -> dict[str, str]:
    """Simple health check endpoint."""

    return {"status": "ok"}

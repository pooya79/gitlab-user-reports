"""FastAPI application factory and wiring."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import init_db
from app.frontend import STATIC_DIR


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize resources such as the database before serving requests."""

    init_db()
    yield


settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.mount("/static", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
app.include_router(api_router)


@app.get("/health", tags=["health"])  # pragma: no cover - trivial endpoint
async def health() -> dict[str, str]:
    """Simple health check endpoint."""

    return {"status": "ok"}

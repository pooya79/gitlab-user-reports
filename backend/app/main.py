"""FastAPI application factory and wiring."""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)


if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        logging.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error."},
        )


app.include_router(api_router, prefix="/api")


@app.get("/api/health", tags=["health"])  # pragma: no cover - trivial endpoint
async def health() -> dict[str, str]:
    """Simple health check endpoint."""

    return {"status": "ok"}

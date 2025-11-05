"""API route modules available for inclusion."""

from fastapi import APIRouter

from .auth import router as auth_router


def get_routes() -> list[APIRouter]:
    """Return the list of routers that should be registered."""

    return [auth_router]


__all__ = ["auth_router", "get_routes"]

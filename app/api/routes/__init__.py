"""API route modules available for inclusion."""

from fastapi import APIRouter

from .auth import router as auth_router
from .user_performance import router as user_performance_router


def get_routes() -> list[APIRouter]:
    """Return the list of routers that should be registered."""

    return [auth_router, user_performance_router]


__all__ = ["auth_router", "get_routes"]

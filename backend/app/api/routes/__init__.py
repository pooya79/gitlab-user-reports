"""API route modules available for inclusion."""

from fastapi import APIRouter

from .auth import router as auth_router
from .user_performance import router as user_performance_router
from .gitlab import router as gitlab_router
from .users import router as users


def get_routes() -> list[APIRouter]:
    """Return the list of routers that should be registered."""

    return [auth_router, user_performance_router, gitlab_router, users]


__all__ = ["auth_router", "get_routes"]

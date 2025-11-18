"""API route modules available for inclusion."""

from fastapi import APIRouter

from .auth import router as auth_router
from .project_user_performance import router as user_performance_router
from .gitlab import router as gitlab_router
from .users import router as users
from .performance import router as performance_router


def get_routes() -> list[APIRouter]:
    """Return the list of routers that should be registered."""

    return [auth_router, user_performance_router, gitlab_router, users, performance_router]


__all__ = ["auth_router", "get_routes"]

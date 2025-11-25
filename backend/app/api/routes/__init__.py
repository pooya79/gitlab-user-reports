"""API route modules available for inclusion."""

from fastapi import APIRouter

from .auth import router as auth_router
from .projects import router as projects_router
from .users import router as users
from .performance import router as performance_router
from .scheduler import router as scheduler_router


def get_routes() -> list[APIRouter]:
    """Return the list of routers that should be registered."""

    return [auth_router, projects_router, users, performance_router, scheduler_router]


__all__ = ["auth_router", "get_routes"]

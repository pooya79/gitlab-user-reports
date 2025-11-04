"""Aggregate API router."""

from fastapi import APIRouter

from app.api.routes import pages, users

api_router = APIRouter()
api_router.include_router(users.router)
api_router.include_router(pages.router)

__all__ = ["api_router"]

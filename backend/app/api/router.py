"""Aggregate API router."""

from fastapi import APIRouter

from app.api.routes import get_routes

api_router = APIRouter()

for router in get_routes():
    api_router.include_router(router)


__all__ = ["api_router"]

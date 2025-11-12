"""Pydantic schemas for request/response models."""

from fastapi import status
from pydantic import BaseModel


class ErrorResponseModel(BaseModel):
    """Standard error response model."""

    detail: str


class GeneralErrorResponses:
    BAD_REQUEST = {"model": ErrorResponseModel, "description": "Bad Request"}
    UNAUTHORIZED = {"model": ErrorResponseModel, "description": "Invalid credentials"}
    FORBIDDEN = {"model": ErrorResponseModel, "description": "Forbidden"}
    NOT_FOUND = {"model": ErrorResponseModel, "description": "Resource not found"}
    INTERNAL_SERVER_ERROR = {
        "model": ErrorResponseModel,
        "description": "Internal Server Error",
    }
    BAD_GATEWAY = {
        "model": ErrorResponseModel,
        "description": "Bad Gateway",
    }

    ALL = {
        status.HTTP_400_BAD_REQUEST: BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED: UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN: FORBIDDEN,
        status.HTTP_404_NOT_FOUND: NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR: INTERNAL_SERVER_ERROR,
        status.HTTP_502_BAD_GATEWAY: BAD_GATEWAY,
    }

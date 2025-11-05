"""Pydantic schemas for authentication endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    """Incoming payload for user login or first-time bootstrap."""

    username: str = Field(min_length=3, max_length=128)
    password: str = Field(min_length=8, max_length=256)
    gitlab_url: AnyHttpUrl | None = None
    gitlab_admin_token: str | None = Field(default=None, min_length=1)

    @field_validator("username")
    @classmethod
    def _strip_username(cls, value: str) -> str:
        return value.strip()


class LoginResponse(BaseModel):
    """Token response returned after successful authentication."""

    access_token: str
    token_type: str = "bearer"
    username: str
    expires_at: datetime
    gitlab_configured: bool
    gitlab_user_info: dict[str, Any] | None = None


class GitLabConfigRequest(BaseModel):
    """Payload for configuring the GitLab admin token and URL."""

    gitlab_url: AnyHttpUrl
    gitlab_admin_token: str = Field(min_length=1)


class GitLabConfigResponse(BaseModel):
    """Response after updating the GitLab configuration."""

    gitlab_user_info: dict[str, Any]
    gitlab_url: AnyHttpUrl


class UserProfileResponse(BaseModel):
    """Basic profile snapshot for the single configured user."""

    username: str
    gitlab_user_info: dict[str, Any] | None = None
    gitlab_url: AnyHttpUrl | None = None


class LogoutResponse(BaseModel):
    """Acknowledgement returned after logout."""

    success: bool = True

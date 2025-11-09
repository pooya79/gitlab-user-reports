"""Pydantic schemas for gitlab endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MembersResponse(BaseModel):
    """Response schema for GitLab project members."""

    id: int = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    name: str = Field(..., description="Full name")
    web_url: str = Field(..., description="Web URL to the user's profile")
    avatar_url: str | None = Field(None, description="URL to the user's avatar")
    state: str = Field(..., description="Account state")
    access_level: int = Field(..., description="Access level in the project")
    access_level_name: str = Field(..., description="Access level name")

class ProjectsResponse(BaseModel):
    """Response schema for GitLab projects."""

    id: int = Field(..., description="Project ID")
    name: str = Field(..., description="Project name")
    name_with_namespace: str = Field(..., description="Project name with namespace")
    path_with_namespace: str = Field(..., description="Project path with namespace")
    web_url: str = Field(..., description="Web URL to the project")
    avatar_url: str | None = Field(None, description="URL to the project's avatar")
    created_at: datetime = Field(..., description="Project creation timestamp")


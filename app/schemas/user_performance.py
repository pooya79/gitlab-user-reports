"""Pydantic schemas for user performance endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, ValidationInfo, field_validator


class UserPerformanceRequest(BaseModel):
    """Incoming payload for fetching user performance data."""

    user_id: int = Field(..., description="The ID of the GitLa user.")
    project_id: int | str = Field(
        ..., description="The ID or path of the GitLab project."
    )
    start_date: datetime
    end_date: datetime

    # Check time interval is less than or equal to 1 week
    @field_validator("end_date")
    @classmethod
    def validate_date_range(cls, end_date: datetime, info: ValidationInfo) -> datetime:
        start_date = info.data.get("start_date")
        if start_date and (end_date - start_date).days > 7:
            raise ValueError("The date range should not exceed 1 week.")
        return end_date


class Commits(BaseModel):
    """Details of a Commit."""

    title: str
    message: str
    web_url: str
    authored_date: datetime
    additions: int
    deletions: int


class MrDetails(BaseModel):
    """Details of a Merge Request."""

    iid: int
    title: str
    description: str
    web_url: str
    created_at: datetime
    state: str

    commits_count: int
    commits: list[Commits]  # List of commits


class UserPerformanceResponse(BaseModel):
    """Response model for user performance data."""

    username: str
    project_path_name: str
    since: datetime
    until: datetime
    total_commits: int
    total_additions: int
    total_deletions: int
    total_changes: int
    total_mr_contributed: int
    daily_commit_counts: dict[str, int]  # date string to commit count mapping
    daily_additions: dict[str, int]  # date string to additions count mapping
    daily_deletions: dict[str, int]  # date string to deletions count mapping
    daily_changes: dict[str, int]  # date string to changes count mapping
    merge_requests: list[MrDetails]  # List of merge requests details
    llm_prompt_suggestion: str
    prompt_tokens: int
    calculated_at: datetime

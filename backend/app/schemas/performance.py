"""Schemas describing global user performance derived from GitLab activity."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator, field_validator


def extract_numeric_id(gid: str) -> int:
    try:
        return int(gid.split("/")[-1])
    except Exception:
        return -1  # fallback if unexpected format


def _normalize_to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        # naive datetime → treat it as UTC (your policy)
        return dt.replace(tzinfo=datetime.timezone.utc)

    # aware datetime → convert to UTC
    return dt.astimezone(datetime.timezone.utc)


class UserPerformanceRequest(BaseModel):
    """Input parameters for performance evaluation."""

    user_id: int = Field(..., description="The ID of the GitLab user.")
    project_id: int | str | None = Field(
        None,
        description="Optional GitLab project ID or path to scope the performance data.",
    )
    start_date: datetime = Field(
        ..., description="The start date for the performance period in UTC."
    )
    end_date: datetime = Field(
        ..., description="The end date for the performance period in UTC."
    )

    # Check that start_date is before end_date and range is less than or equal to 1 week
    @model_validator(mode="after")
    def validate_time_interval(self) -> UserPerformanceRequest:
        # convert to aware UTC
        self.start_date = _normalize_to_utc(self.start_date)
        self.end_date = _normalize_to_utc(self.end_date)

        if self.start_date >= self.end_date:
            raise ValueError("start_date must be before end_date.")
        if (self.end_date - self.start_date).days > 7:
            raise ValueError("The date range should not exceed 1 week.")
        return self


class ProjectInfo(BaseModel):
    id: int
    name: str
    avatar_url: str | None = None
    web_url: str
    full_path: str
    name_with_namespace: str

    @field_validator("id", mode="before")
    def convert_id(cls, v):
        return extract_numeric_id(v) if isinstance(v, str) else v


class UserInfo(BaseModel):
    id: int
    name: str
    username: str
    email: str | None = None
    avatar_url: str | None = None
    web_url: str | None = None

    @field_validator("id", mode="before")
    def convert_id(cls, v):
        return extract_numeric_id(v) if isinstance(v, str) else v


class Commit(BaseModel):
    """Details of a Commit."""

    title: str
    message: str
    web_url: str
    authored_date: datetime
    additions: int
    deletions: int


class MergeRequestDetails(BaseModel):
    """Details of a Merge Request."""

    iid: int
    title: str
    description: str
    web_url: str
    state: str
    created_at: datetime
    total_commits: int
    total_additions: int
    total_deletions: int

    commits_count: int
    commits: list[Commit]  # List of commits


class ProjectPerformanceResponse(BaseModel):
    """Response model for project-scoped user performance data."""

    user_email: str
    project_id: int
    project_name: str
    project_path_name: str
    avatar_url: str | None = None
    web_url: str
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

    calculated_at: datetime

    merge_requests: list[MergeRequestDetails]


class IssueInfo(BaseModel):
    iid: str
    title: str
    webUrl: str
    state: str
    reference: str


class MergeRequestInfo(BaseModel):
    iid: str
    title: str
    webUrl: str
    state: str
    reference: str


class ProjectTimelogs(BaseModel):
    project: ProjectInfo
    timelogs: list[TimelogNode]
    total_time_spent_hours: float


class TimelogNode(BaseModel):
    id: int
    project: ProjectInfo
    time_spent: int  # in seconds
    spent_at: str  # ISO datetime string
    summary: str | None = None
    issue: IssueInfo | None = None
    merge_request: MergeRequestInfo | None = None

    @field_validator("id", mode="before")
    def convert_id(cls, v):
        return extract_numeric_id(v) if isinstance(v, str) else v


class TimeSpentStats(BaseModel):
    """Time-spent related actions such as time logged and issue handling."""

    username: str = Field(..., description="The username of the GitLab user.")
    total_time_logged_hours: float = Field(..., ge=0.0)

    time_spent_per_day: dict[str, float]  # date string to hours logged mapping
    project_time_spent: dict[str, float]  # project path to hours logged mapping

    timelog_entries: list[TimelogNode]


class CodeReviewStats(BaseModel):
    """Review-oriented actions such as approvals and comments."""

    approvals_given: int = Field(..., ge=0)
    review_comments: int = Field(..., ge=0)
    reviewed_merge_requests: int = Field(..., ge=0)
    notes_authored: int = Field(..., ge=0)


class GeneralUserPerformance(BaseModel):
    """Top-level data structure returned by the performance service."""

    user_info: UserInfo
    start_date: datetime
    end_date: datetime
    period_days: int
    total_commits: int
    total_additions: int
    total_deletions: int
    total_changes: int
    total_mr_contributed: int
    daily_commit_counts: dict[str, int]  # date string to commit count mapping
    daily_additions: dict[str, int]  # date string to additions count mapping
    daily_deletions: dict[str, int]  # date string to deletions count mapping
    daily_changes: dict[str, int]  # date string to changes count mapping

    code_review_stats: CodeReviewStats

    project_performances: list[ProjectPerformanceResponse]

    calculated_at: datetime

    @model_validator(mode="after")
    def validate_time_interval(self) -> GeneralUserPerformance:
        if self.start_date >= self.end_date:
            raise ValueError("start_date must be before end_date.")
        return self

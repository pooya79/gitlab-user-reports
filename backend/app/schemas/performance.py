"""Pydantic models describing GitLab-based user performance and activity."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
    field_serializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def extract_numeric_id(gid: str) -> int:
    """Extract the numeric ID from a GitLab global ID or return -1 on failure."""
    try:
        return int(gid.split("/")[-1])
    except Exception:
        return -1  # fallback if unexpected format


def _normalize_to_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware and converted to UTC."""
    if dt.tzinfo is None:
        # Naive datetime → treat it as UTC according to our policy
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# Lightweight Gitlab entity models
# ---------------------------------------------------------------------------


class IssueInfo(BaseModel):
    """Minimal issue reference used in timelog entries."""

    model_config = ConfigDict(populate_by_name=True)

    iid: str
    title: str
    web_url: str = Field(alias="webUrl")
    state: str
    reference: str


class MergeRequestInfo(BaseModel):
    """Minimal merge request reference used in timelog entries."""

    model_config = ConfigDict(populate_by_name=True)

    iid: str
    title: str
    web_url: str = Field(alias="webUrl")
    state: str
    reference: str


class ProjectInfo(BaseModel):
    """Basic information about a GitLab project."""

    id: int
    name: str
    avatar_url: str | None = None
    web_url: str
    path_with_namespace: str
    name_with_namespace: str

    @field_validator("id", mode="before")
    def convert_id(cls, v: int | str) -> int:
        return extract_numeric_id(v) if isinstance(v, str) else v


class CommitInfo(BaseModel):
    """Single commit details."""

    title: str
    message: str
    web_url: str
    authored_date: datetime
    additions: int
    deletions: int


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class UserPerformanceRequest(BaseModel):
    """Input parameters for a user performance query."""

    user_id: int = Field(..., description="Numeric ID of the GitLab user.")
    project_id: int | str | None = Field(
        None,
        description=(
            "Optional GitLab project ID or full path to scope the performance data. "
            "If omitted, aggregates across all accessible projects."
        ),
    )
    start_date: datetime = Field(
        ...,
        description=(
            "Start of the performance window (any timezone is accepted; "
            "internally normalized to UTC)."
        ),
    )
    end_date: datetime = Field(
        ...,
        description=(
            "End of the performance window (any timezone is accepted; "
            "internally normalized to UTC)."
        ),
    )

    @model_validator(mode="after")
    def validate_time_interval(self) -> "UserPerformanceRequest":
        """Normalize times to UTC and validate the range."""
        self.start_date = _normalize_to_utc(self.start_date)
        self.end_date = _normalize_to_utc(self.end_date)

        if self.start_date >= self.end_date:
            raise ValueError("start_date must be strictly before end_date.")

        if self.end_date - self.start_date > timedelta(days=7):
            raise ValueError("The date range must not exceed 7 days.")

        return self


# ---------------------------------------------------------------------------
# Timelog-related models
# ---------------------------------------------------------------------------


class TimelogNode(BaseModel):
    """Single timelog entry for a project/issue/MR."""

    id: int
    project: ProjectInfo
    time_spent: int  # seconds
    spent_at: datetime  # normalized from ISO string by Pydantic
    summary: str | None = None
    issue: IssueInfo | None = None
    merge_request: MergeRequestInfo | None = None

    @field_validator("id", mode="before")
    def convert_id(cls, v: int | str) -> int:
        return extract_numeric_id(v) if isinstance(v, str) else v

    @field_validator("spent_at", mode="after")
    def normalize_spent_at(cls, v: datetime) -> datetime:
        return _normalize_to_utc(v)


class ProjectTimelogs(BaseModel):
    """Timelog aggregation for a single project."""

    project: ProjectInfo
    timelogs: list[TimelogNode]
    total_time_spent_hours: float


# ---------------------------------------------------------------------------
# Aggregated stats
# ---------------------------------------------------------------------------


class MergeRequestDetails(MergeRequestInfo):
    """Detailed information about a merge request and its commits."""

    description: str
    created_at: datetime

    total_commits: int
    total_additions: int
    total_deletions: int

    commits_count: int
    commits: list[CommitInfo] | None = None


class ProjectPerformanceShort(ProjectInfo):
    """Short summary of project-scoped performance metrics for a user."""

    since: datetime
    until: datetime

    commits: int
    additions: int
    deletions: int
    changes: int

    mr_contributed: int

    calculated_at: datetime

    merge_requests: list[MergeRequestDetails] | None = None

    @model_validator(mode="after")
    def normalize_dates(self) -> "ProjectPerformanceResponse":
        self.since = _normalize_to_utc(self.since)
        self.until = _normalize_to_utc(self.until)
        self.calculated_at = _normalize_to_utc(self.calculated_at)
        return self


class ProjectPerformanceResponse(ProjectPerformanceShort):
    """Project-scoped performance metrics for a user."""

    # Per-day counts
    daily_commit_counts: dict[datetime, int]
    daily_additions: dict[datetime, int]
    daily_deletions: dict[datetime, int]
    daily_changes: dict[datetime, int]

    @field_serializer(
        "daily_commit_counts",
        "daily_additions",
        "daily_deletions",
        "daily_changes",
    )
    def _serialize_daily_maps(self, value: dict[datetime, int]) -> dict[str, int]:
        # Mongo-safe: string keys
        return {k.isoformat(): v for k, v in value.items()}

    @field_validator(
        "daily_commit_counts",
        "daily_additions",
        "daily_deletions",
        "daily_changes",
        mode="before",
    )
    @classmethod
    def _parse_daily_maps(cls, v):
        # When loading from Mongo, keys are strings
        if isinstance(v, dict):
            out: dict[datetime, int] = {}
            for k, val in v.items():
                if isinstance(k, datetime):
                    dt = k
                else:
                    dt = datetime.fromisoformat(k)
                out[dt] = val
            return out
        return v


class TimeSpentStats(BaseModel):
    """Time-spent related activity such as logged time per day and per project."""

    user_id: int
    username: str

    daily_project_time_spent: list[
        tuple[datetime, str, float]
    ]  # date → project name → hours

    total_time_spent_hours: float
    mr_contributed: int
    issue_contributed: int

    project_timelogs: list[ProjectTimelogs]


class CodeReviewStats(BaseModel):
    """Review-oriented actions such as approvals and comments."""

    approvals_given: int = Field(..., ge=0)
    review_comments: int = Field(..., ge=0)
    reviewed_merge_requests: int = Field(..., ge=0)
    notes_authored: int = Field(..., ge=0)


class GeneralUserPerformance(BaseModel):
    """Top-level structure returned by the performance service."""

    userd_id: int
    username: str

    # KPIs
    commits: int
    additions: int
    deletions: int
    changes: int
    mr_contributed: int
    approvals_given: int
    review_merge_requests: int
    review_comments: int
    notes_authored: int

    # Daily status
    daily_commit_counts: dict[datetime, int]
    daily_additions: dict[datetime, int]
    daily_deletions: dict[datetime, int]
    daily_changes: dict[datetime, int]

    # Per-project performance
    project_performances: list[ProjectPerformanceShort]

    @field_serializer(
        "daily_commit_counts",
        "daily_additions",
        "daily_deletions",
        "daily_changes",
    )
    def _serialize_daily_maps(self, value: dict[datetime, int]) -> dict[str, int]:
        # Mongo-safe: string keys
        return {k.isoformat(): v for k, v in value.items()}

    @field_validator(
        "daily_commit_counts",
        "daily_additions",
        "daily_deletions",
        "daily_changes",
        mode="before",
    )
    @classmethod
    def _parse_daily_maps(cls, v):
        # When loading from Mongo, keys are strings
        if isinstance(v, dict):
            out: dict[datetime, int] = {}
            for k, val in v.items():
                if isinstance(k, datetime):
                    dt = k
                else:
                    dt = datetime.fromisoformat(k)
                out[dt] = val
            return out
        return v

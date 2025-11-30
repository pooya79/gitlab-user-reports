"""Schemas for configuring scheduled performance email reports."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

_DAY_NAME_MAP = {
    0: "mon",
    1: "tue",
    2: "wed",
    3: "thu",
    4: "fri",
    5: "sat",
    6: "sun",
    "0": "mon",
    "1": "tue",
    "2": "wed",
    "3": "thu",
    "4": "fri",
    "5": "sat",
    "6": "sun",
    "mon": "mon",
    "monday": "mon",
    "tue": "tue",
    "tuesday": "tue",
    "wed": "wed",
    "wednesday": "wed",
    "thu": "thu",
    "thursday": "thu",
    "fri": "fri",
    "friday": "fri",
    "sat": "sat",
    "saturday": "sat",
    "sun": "sun",
    "sunday": "sun",
}


class ScheduledReportBase(BaseModel):
    """Base attributes shared across scheduling operations."""

    model_config = ConfigDict(populate_by_name=True)

    user_id: int = Field(..., description="GitLab user ID to generate the report for.")
    to: list[EmailStr] = Field(
        ..., description="Primary recipient list for the report email."
    )
    cc: list[EmailStr] = Field(
        default_factory=list, description="Optional CC recipients for the report email."
    )
    bcc: list[EmailStr] = Field(
        default_factory=list,
        description="Optional BCC recipients for the report email.",
    )
    subject: str | None = Field(
        None, description="Optional subject override. Defaults to a generated subject."
    )
    day_of_week: str = Field(
        "mon",
        description="APScheduler day-of-week value (mon-sun or 0-6). Uses UTC.",
    )
    hour_utc: int = Field(
        7, ge=0, le=23, description="Hour of the day (UTC) to send the report."
    )
    minute_utc: int = Field(
        0, ge=0, le=59, description="Minute of the hour (UTC) to send the report."
    )
    active: bool = Field(
        default=True,
        description="Whether the schedule is enabled. Disabled schedules do not run.",
    )

    @field_validator("to")
    @classmethod
    def _ensure_recipients(cls, value: list[EmailStr]) -> list[EmailStr]:
        if not value:
            raise ValueError("at least one primary recipient is required")
        return value

    @field_validator("day_of_week")
    @classmethod
    def _normalize_day(cls, value: Any) -> str:
        if isinstance(value, bool):
            raise ValueError("day_of_week must be one of mon-sun or 0-6")
        mapped = (
            _DAY_NAME_MAP.get(str(value).lower())
            if not isinstance(value, int)
            else _DAY_NAME_MAP.get(value)
        )
        if mapped is None:
            raise ValueError("day_of_week must be one of mon-sun or 0-6")
        return mapped


class ScheduledReportCreate(ScheduledReportBase):
    """Payload for creating a new schedule."""

    pass


class ScheduledReportUpdate(BaseModel):
    """Payload for updating an existing schedule."""

    to: list[EmailStr] | None = None
    cc: list[EmailStr] | None = None
    bcc: list[EmailStr] | None = None
    subject: str | None = None
    day_of_week: str | int | None = None
    hour_utc: int | None = Field(
        None, ge=0, le=23, description="Hour of the day (UTC) to send the report."
    )
    minute_utc: int | None = Field(
        None, ge=0, le=59, description="Minute of the hour (UTC) to send the report."
    )
    active: bool | None = None

    @field_validator("day_of_week")
    @classmethod
    def _normalize_day(cls, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, bool):
            raise ValueError("day_of_week must be one of mon-sun or 0-6")
        mapped = (
            _DAY_NAME_MAP.get(str(value).lower())
            if not isinstance(value, int)
            else _DAY_NAME_MAP.get(value)
        )
        if mapped is None:
            raise ValueError("day_of_week must be one of mon-sun or 0-6")
        return mapped


class ScheduledReportResponse(ScheduledReportBase):
    """Response model describing a scheduled report."""

    id: str
    last_sent_at: datetime | None = None
    last_error: str | None = None
    last_email_content: str | None = Field(
        default=None, description="HTML body of the last sent report."
    )
    created_at: datetime | None = None
    updated_at: datetime | None = None
    next_run_at: datetime | None = Field(
        None, description="Next planned runtime for this schedule (UTC)."
    )

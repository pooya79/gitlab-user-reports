from typing import List, Optional
from pydantic import BaseModel, model_validator, field_validator
from datetime import datetime


def extract_numeric_id(gid: str) -> int:
    try:
        return int(gid.split("/")[-1])
    except Exception:
        return -1  # fallback if unexpected format


class GitLabUser(BaseModel):
    id: int
    username: str
    public_email: Optional[str]
    name: str
    state: str
    locked: bool
    avatar_url: Optional[str]
    web_url: str
    created_at: datetime
    bot: bool
    last_sign_in_at: Optional[datetime]
    email: Optional[str]
    is_admin: bool


class TimelogsRequest(BaseModel):
    username: str
    startTime: datetime  # ISO datetime string
    endTime: datetime  # ISO datetime string

    # Check time interval is less than or equal to 1 week
    @model_validator(mode="after")
    def check_date_range(self):
        if (self.endTime - self.startTime).days > 7:
            raise ValueError("The date range should not exceed 1 week.")
        return self


class ProjectInfo(BaseModel):
    id: int
    webUrl: str
    fullPath: str
    nameWithNamespace: str

    @field_validator("id", mode="before")
    def convert_id(cls, v):
        return extract_numeric_id(v) if isinstance(v, str) else v


class UserInfo(BaseModel):
    id: int
    name: str
    username: str
    avatarUrl: Optional[str] = None
    webPath: Optional[str] = None

    @field_validator("id", mode="before")
    def convert_id(cls, v):
        return extract_numeric_id(v) if isinstance(v, str) else v


class NoteInfo(BaseModel):
    id: int
    body: str

    @field_validator("id", mode="before")
    def convert_id(cls, v):
        return extract_numeric_id(v) if isinstance(v, str) else v


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


class TimelogNode(BaseModel):
    id: int
    project: ProjectInfo
    timeSpent: int  # in seconds
    user: UserInfo
    spentAt: str  # ISO datetime string
    note: Optional[NoteInfo] = None
    summary: Optional[str] = None
    issue: Optional[IssueInfo] = None
    mergeRequest: Optional[MergeRequestInfo] = None

    @field_validator("id", mode="before")
    def convert_id(cls, v):
        return extract_numeric_id(v) if isinstance(v, str) else v


class PageInfo(BaseModel):
    hasNextPage: bool
    hasPreviousPage: bool
    startCursor: Optional[str] = None
    endCursor: Optional[str] = None


class TimelogData(BaseModel):
    count: int
    totalSpentTime: str  # returned as string by GitLab
    nodes: List[TimelogNode]
    pageInfo: PageInfo

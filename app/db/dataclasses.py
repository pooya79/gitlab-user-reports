from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, List

@dataclass(slots=True)
class Commit:
    """Represents a GitLab commit document."""

    id: str
    project_id: str
    project_path_name: str
    short_id: str
    title: str
    message: str
    author_name: str
    author_email: str
    created_at: datetime
    web_url: str
    id: str | None = None
    committer_name: str | None = None
    committer_email: str | None = None
    authored_date: datetime | None = None
    committed_date: datetime | None = None
    parent_ids: list[str] | None = None
    trailers: dict[str, Any] | None = None
    extended_trailers: dict[str, Any] | None = None

    def to_document(self) -> dict[str, Any]:
        """Serialize the commit to a MongoDB-friendly document."""

        document: dict[str, Any] = {
            "id": self.id,
            "project_id": self.project_id,
            "project_path_name": self.project_path_name,
            "short_id": self.short_id,
            "title": self.title,
            "message": self.message,
            "author_name": self.author_name,
            "author_email": self.author_email,
            "committer_name": self.committer_name,
            "committer_email": self.committer_email,
            "authored_date": self.authored_date,
            "committed_date": self.committed_date,
            "created_at": self.created_at,
            "parent_ids": self.parent_ids,
            "trailers": self.trailers,
            "extended_trailers": self.extended_trailers,
            "web_url": self.web_url,
        }
        if self.id is not None:
            document["_id"] = self.id
        return {key: value for key, value in document.items() if value is not None}

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        preview = self.title[:30] + ("..." if len(self.title) > 30 else "")
        return f"<Commit {self.short_id} ({preview})>"


@dataclass(slots=True)
class MergeRequest:
    """Represents a GitLab merge request record."""

    id: int
    iid: int
    project_id: int
    project_path_name: str
    title: str
    state: str
    created_at: datetime
    updated_at: datetime
    source_branch: str
    target_branch: str
    web_url: str
    description: str | None = None
    merge_status: str | None = None
    source_project_id: int | None = None
    target_project_id: int | None = None
    sha: str | None = None
    merge_commit_sha: str | None = None
    squash_commit_sha: str | None = None
    upvotes: int = 0
    downvotes: int = 0
    user_notes_count: int = 0
    draft: bool = False
    work_in_progress: bool = False
    discussion_locked: bool | None = None
    merge_when_pipeline_succeeds: bool = False
    should_remove_source_branch: bool | None = None
    force_remove_source_branch: bool = False
    author: dict[str, Any] | None = None
    assignee: dict[str, Any] | None = None
    milestone: dict[str, Any] | None = None
    labels: list[str] | None = None
    time_stats: dict[str, Any] | None = None

    def to_document(self) -> dict[str, Any]:
        """Serialize the merge request to a MongoDB-friendly document."""

        document: dict[str, Any] = {
            "_id": self.id,
            "iid": self.iid,
            "project_id": self.project_id,
            "project_path_name": self.project_path_name,
            "title": self.title,
            "description": self.description,
            "state": self.state,
            "merge_status": self.merge_status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "source_branch": self.source_branch,
            "target_branch": self.target_branch,
            "source_project_id": self.source_project_id,
            "target_project_id": self.target_project_id,
            "sha": self.sha,
            "merge_commit_sha": self.merge_commit_sha,
            "squash_commit_sha": self.squash_commit_sha,
            "upvotes": self.upvotes,
            "downvotes": self.downvotes,
            "user_notes_count": self.user_notes_count,
            "draft": self.draft,
            "work_in_progress": self.work_in_progress,
            "discussion_locked": self.discussion_locked,
            "merge_when_pipeline_succeeds": self.merge_when_pipeline_succeeds,
            "should_remove_source_branch": self.should_remove_source_branch,
            "force_remove_source_branch": self.force_remove_source_branch,
            "author": self.author,
            "assignee": self.assignee,
            "milestone": self.milestone,
            "labels": self.labels,
            "time_stats": self.time_stats,
            "web_url": self.web_url,
        }
        return {key: value for key, value in document.items() if value is not None}

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        preview = self.title[:40] + ("..." if len(self.title) > 40 else "")
        return f"<MergeRequest {self.iid} ({self.state}) {preview}>"
    

@dataclass(slots=True)
class Diff:
    """Represents a single file diff entry in a GitLab merge request."""

    old_path: str
    new_path: str
    a_mode: str
    b_mode: str
    diff: str
    collapsed: bool
    too_large: bool
    new_file: bool
    renamed_file: bool
    deleted_file: bool
    generated_file: bool

    def to_document(self) -> dict[str, Any]:
        """Serialize the diff entry to a MongoDB-friendly document."""
        return {
            "old_path": self.old_path,
            "new_path": self.new_path,
            "a_mode": self.a_mode,
            "b_mode": self.b_mode,
            "diff": self.diff,
            "collapsed": self.collapsed,
            "too_large": self.too_large,
            "new_file": self.new_file,
            "renamed_file": self.renamed_file,
            "deleted_file": self.deleted_file,
            "generated_file": self.generated_file,
        }


@dataclass(slots=True)
class MergeRequestDiffs:
    """Represents a snapshot of all diffs for a merge request at a given time."""

    project_id: int
    project_path_name: str
    merge_request_iid: int
    timestamp: datetime
    diffs: List[Diff] = field(default_factory=list)

    def to_document(self) -> dict[str, Any]:
        """Serialize the snapshot to a MongoDB-friendly document."""
        return {
            "project_id": self.project_id,
            "project_path_name": self.project_path_name,
            "merge_request_iid": self.merge_request_iid,
            "timestamp": self.timestamp,
            "diffs": [diff.to_document() for diff in self.diffs],
        }

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MR#{self.merge_request_iid} DiffSnapshot ({len(self.diffs)} diffs)>"
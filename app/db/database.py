"""MongoDB client helpers and lifecycle management."""

from __future__ import annotations

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import get_settings

_client: MongoClient | None = None


def get_client() -> MongoClient:
    """Return a shared MongoDB client instance."""

    global _client
    if _client is None:
        settings = get_settings()
        _client = MongoClient(settings.mongodb.uri)
    return _client


def close_client() -> None:
    """Cleanly close the MongoDB client if it has been created."""

    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_database() -> Database:
    """Retrieve the configured MongoDB database."""

    settings = get_settings()
    return get_client()[settings.mongodb_database]


def init_db() -> None:
    """Create required indexes for the application collections."""

    db = get_database()
    commits = db["commits"]
    commits.create_index("id", unique=True)
    merge_requests = db["merge_requests"]
    merge_requests.create_index("id", unique=True)
    merge_request_diffs = db["merge_request_diffs"]
    merge_request_diffs.create_index(
        [
            ("project_id", 1),  # ascending
            ("mr_iid", 1),  # ascending
            ("timestamp", -1),  # descending
        ],
        name="project_mr_timestamp_idx",
    )

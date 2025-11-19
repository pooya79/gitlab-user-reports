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
        mongodb = settings.mongodb
        if mongodb.root_username and mongodb.root_password:
            uri = f"mongodb://{mongodb.root_username}:{mongodb.root_password}@{mongodb.host}:{mongodb.port}/{mongodb.database}?authSource=admin"
        else:
            uri = f"mongodb://{mongodb.host}:{mongodb.port}/{mongodb.database}"

        _client = MongoClient(uri)
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
    return get_client()[settings.mongodb.database]


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

    performance_cache = db["performance_cache"]
    performance_cache.create_index(
        [
            ("user_id", 1),
            ("type", 1),
            ("start_date", 1),
            ("end_date", 1),
        ],
        name="user_date_range_idx",
    )
    performance_cache.create_index(
        [
            ("user_id", 1),
            ("project_id", 1),
            ("type", 1),
            ("start_date", 1),
            ("end_date", 1),
        ],
        unique=True,
        name="user_project_date_range_idx",
    )
    performance_cache.create_index("expires_at", expireAfterSeconds=0)

    auth_session = db["auth_session"]
    auth_session.create_index("jti", unique=True)
    auth_session.create_index("expires_at", expireAfterSeconds=0)

    app_user_config = db["app_user_config"]

"""Shared FastAPI dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import gitlab
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from pymongo.database import Database

from app.core.config import Settings, get_settings
from app.db.database import get_database as _get_database
from app.services import NOW_UTC
from app.services.gitlab import GitLabTokenError, validate_gitlab_admin_token
from app.services.security import decode_token


_http_bearer = HTTPBearer(auto_error=False)
_LOGIN_REQUIRED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="login_required",
)
_GITLAB_TOKEN_REQUIRED = HTTPException(
    status_code=status.HTTP_428_PRECONDITION_REQUIRED,
    detail="gitlab_token_required",
)


@dataclass(slots=True)
class AuthContext:
    """Represents the authenticated request context."""

    username: str
    session: dict[str, Any]
    user_config: dict[str, Any]
    gitlab_client: gitlab.Gitlab
    gitlab_user_info: dict[str, Any]


def get_mongo_database() -> Database:
    """Expose the configured MongoDB database instance."""

    return _get_database()


def get_app_settings() -> Settings:
    """Expose application settings for dependency injection."""

    return get_settings()


def get_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_http_bearer),
    mongo_db: Database = Depends(get_mongo_database),
) -> AuthContext:
    """Get the authenticated user's username from the JWT."""

    if credentials is None:
        raise _LOGIN_REQUIRED

    token = credentials.credentials
    try:
        payload = decode_token(token, get_settings())
    except InvalidTokenError as err:
        raise _LOGIN_REQUIRED from err

    username = payload.get("sub")
    if not username:
        raise _LOGIN_REQUIRED

    user_config = mongo_db["app_user_config"].find_one({})
    if not user_config or user_config.get("username") != username:
        raise _LOGIN_REQUIRED

    return AuthContext(
        username=username,
        session={},
        user_config=user_config,
        gitlab_client=None,
        gitlab_user_info={},
    )


def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(_http_bearer),
    mongo_db: Database = Depends(get_mongo_database),
    settings: Settings = Depends(get_app_settings),
) -> AuthContext:
    """Validate the JWT and GitLab token, returning the authenticated context."""

    if credentials is None:
        raise _LOGIN_REQUIRED

    token = credentials.credentials
    try:
        payload = decode_token(token, settings)
    except InvalidTokenError as err:
        raise _LOGIN_REQUIRED from err

    username = payload.get("sub")
    jti = payload.get("jti")
    if not username or not jti:
        raise _LOGIN_REQUIRED

    session = mongo_db["auth_session"].find_one({"jti": jti})
    if not session or session.get("revoked"):
        raise _LOGIN_REQUIRED

    expires_at: datetime | None = session.get("expires_at")
    if expires_at is not None and expires_at <= NOW_UTC():
        mongo_db["auth_session"].update_one({"jti": jti}, {"$set": {"revoked": True}})
        raise _LOGIN_REQUIRED

    user_config = mongo_db["app_user_config"].find_one({})
    if not user_config or user_config.get("username") != username:
        raise _LOGIN_REQUIRED

    gitlab_url = user_config.get("gitlab_url")
    gitlab_token = user_config.get("gitlab_admin_token")
    if not gitlab_url or not gitlab_token:
        raise _GITLAB_TOKEN_REQUIRED

    try:
        gitlab_user_info, gitlab_client = validate_gitlab_admin_token(
            gitlab_url=gitlab_url,
            admin_token=gitlab_token,
        )
    except GitLabTokenError as err:
        mongo_db["app_user_config"].update_one(
            {"username": username},
            {
                "$unset": {
                    "gitlab_url": "",
                    "gitlab_admin_token": "",
                    "gitlab_user_info": "",
                }
            },
        )
        raise _GITLAB_TOKEN_REQUIRED from err

    if user_config.get("gitlab_user_info") != gitlab_user_info:
        mongo_db["app_user_config"].update_one(
            {"username": username},
            {
                "$set": {
                    "gitlab_user_info": gitlab_user_info,
                    "updated_at": NOW_UTC(),
                }
            },
        )
        user_config["gitlab_user_info"] = gitlab_user_info

    return AuthContext(
        username=username,
        session=session,
        user_config=user_config,
        gitlab_client=gitlab_client,
        gitlab_user_info=gitlab_user_info,
    )


def get_gitlab_client(
    auth_context: AuthContext = Depends(get_auth_context),
) -> gitlab.Gitlab:
    """Expose GitLab client for dependency injection."""

    return auth_context.gitlab_client

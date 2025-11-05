"""Utilities for interacting with GitLab."""

from __future__ import annotations

from typing import Any

import gitlab
from gitlab.exceptions import GitlabAuthenticationError, GitlabError


class GitLabTokenError(Exception):
    """Raised when the GitLab admin token is missing required permissions."""


def validate_gitlab_admin_token(
    *, gitlab_url: str, admin_token: str
) -> tuple[dict[str, Any], gitlab.Gitlab]:
    """Validate the GitLab admin token and return user info alongside the client."""

    try:
        client = gitlab.Gitlab(url=gitlab_url, private_token=admin_token)
        client.auth()
        user_info = client.user.asdict()
    except (GitlabAuthenticationError, GitlabError) as exc:
        raise GitLabTokenError("gitlab_token_invalid") from exc

    if user_info.get("is_admin") is not True:
        raise GitLabTokenError("gitlab_token_not_admin")

    sanitized_user_info = {
        "id": user_info.get("id"),
        "username": user_info.get("username"),
        "name": user_info.get("name"),
        "state": user_info.get("state"),
        "is_admin": user_info.get("is_admin"),
        "email": user_info.get("email"),
    }

    return sanitized_user_info, client

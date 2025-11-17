"""User performance calculation endpoints."""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from pydantic import ValidationError
from fastapi import (
    APIRouter,
    Path,
    Query,
    Depends,
    HTTPException,
    status,
)
from pymongo.database import Database
import gitlab

from app.api.deps import (
    AuthContext,
    get_auth_context,
    get_mongo_database,
)
from app.schemas import GeneralErrorResponses
from app.schemas.project_user_performance import (
    UserPerformanceRequest,
    UserPerformanceResponse,
)
from app.services import NOW_UTC
from app.core.config import get_settings
from app.core.promtps import USER_PERFORMANCE_TEMPLATE

router = APIRouter(
    prefix="/project-user-performance", tags=["project-user-performance"]
)


def _to_iso_midnight(value) -> str:
    """Convert datetime or ISO string to UTC midnight ISO string with 'Z'."""
    if isinstance(value, str):
        # Normalize ISO string to datetime
        value = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    elif not isinstance(value, dt.datetime):
        raise TypeError(f"Unsupported type: {type(value)}")

    # Force UTC midnight
    value = value.replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=dt.timezone.utc
    )
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def get_user_performance_data(
    data: UserPerformanceRequest,
    user: gitlab.v4.objects.User,
    mongo_db: Database,
    gitlab: gitlab.Gitlab,
) -> None:
    """Calculate user performance data and store in database"""
    # Fetch project
    project = gitlab.projects.get(data.project_id)

    # Fetch commits by the user in the project
    commits = project.commits.list(
        since=data.start_date,
        until=data.end_date + dt.timedelta(days=get_settings().safe_date_offset),
        author=getattr(user, "email", None),
        all=True,
        with_stats=True,
    )
    user_commits = [
        c
        for c in commits
        if c.author_email == getattr(user, "email", None)
        and c.authored_date >= str(data.start_date)
        and c.authored_date <= str(data.end_date)
    ]

    # Fetching merge request related to each commit
    mr_iids = set()
    mrs: dict[int, dict] = {}
    mr_to_commit = defaultdict(list)
    for commit in user_commits:
        related_mrs = commit.merge_requests()
        for mr in related_mrs:
            mr_iids.add(mr["iid"])
            mrs[mr["iid"]] = mr
            mr_to_commit[mr["iid"]].append(commit.id)

    # Sort them by date
    sorted_commits = sorted(
        user_commits, key=lambda c: _to_iso_midnight(c.authored_date)
    )

    # Prepare performance data
    daily_commit_counts = defaultdict(int)
    daily_changes = defaultdict(int)
    daily_additions = defaultdict(int)
    daily_deletions = defaultdict(int)
    total_commits = 0
    total_additions = 0
    total_deletions = 0
    merge_requests = []

    for commit in sorted_commits:
        commit_date = _to_iso_midnight(commit.authored_date)
        daily_commit_counts[commit_date] += 1
        daily_additions[commit_date] += commit.stats["additions"]
        daily_deletions[commit_date] += commit.stats["deletions"]
        daily_changes[commit_date] += commit.stats["total"]
        total_commits += 1
        total_additions += commit.stats["additions"]
        total_deletions += commit.stats["deletions"]

    total_mr_contributed = len(mr_iids)

    for mr in mrs.values():
        merge_requests.append(
            {
                "iid": mr["iid"],
                "title": mr["title"],
                "description": mr["description"],
                "web_url": mr["web_url"],
                "created_at": mr["created_at"],
                "state": mr["state"],
                "commits_count": len(mr_to_commit[mr["iid"]]),
                "commits": [
                    {
                        "title": commit.title,
                        "message": commit.message,
                        "web_url": commit.web_url,
                        "authored_date": commit.authored_date,
                        "additions": commit.stats["additions"],
                        "deletions": commit.stats["deletions"],
                    }
                    for commit in user_commits
                    if commit.id in mr_to_commit[mr["iid"]]
                ],
            }
        )

    # Build the Pydantic response object
    user_performance = UserPerformanceResponse(
        username=user.username,
        project_path_name=project.path_with_namespace,
        since=_to_iso_midnight(data.start_date),
        until=_to_iso_midnight(data.end_date),
        total_commits=total_commits,
        total_additions=total_additions,
        total_deletions=total_deletions,
        total_changes=total_additions + total_deletions,
        total_mr_contributed=total_mr_contributed,
        daily_commit_counts=dict(daily_commit_counts),
        daily_additions=dict(daily_additions),
        daily_deletions=dict(daily_deletions),
        daily_changes=dict(daily_changes),
        merge_requests=merge_requests,
        llm_prompt_suggestion="",  # placeholder, set below
        prompt_tokens=0,
        calculated_at=NOW_UTC(),
    )

    # --- Render the LLM prompt using the template and computed data ---
    # Pass a plain dict to keep Jinja access simple
    perf_view = {
        "username": user_performance.username,
        "project_path_name": user_performance.project_path_name,
        "since": user_performance.since,
        "until": user_performance.until,
        "total_commits": user_performance.total_commits,
        "total_additions": user_performance.total_additions,
        "total_deletions": user_performance.total_deletions,
        "total_changes": user_performance.total_changes,
        "total_mr_contributed": user_performance.total_mr_contributed,
        "daily_commit_counts": user_performance.daily_commit_counts,
        "daily_additions": user_performance.daily_additions,
        "daily_deletions": user_performance.daily_deletions,
        "daily_changes": user_performance.daily_changes,
        "merge_requests": user_performance.merge_requests,
    }
    llm_suggestion_prompt = USER_PERFORMANCE_TEMPLATE.render(perf=perf_view)
    user_performance.llm_prompt_suggestion = llm_suggestion_prompt

    # Store the result in MongoDB
    filter_ = {
        "username": user.username,
        "project_path_name": project.path_with_namespace,
        "since": _to_iso_midnight(data.start_date),
        "until": _to_iso_midnight(data.end_date),
    }

    update = {"$set": user_performance.model_dump(mode="json")}

    mongo_db["user_performance"].update_one(filter_, update, upsert=True)

    return user_performance


@router.get(
    "/projects/{project_id}/users/{user_id}/performance",
    response_model=UserPerformanceResponse,
    summary="Get cached user performance data",
    responses={
        401: GeneralErrorResponses().UNAUTHORIZED,
        404: GeneralErrorResponses().NOT_FOUND,
    },
)
async def get_user_performance(
    user_id: int = Path(..., description="GitLab user ID"),
    project_id: str = Path(..., description="GitLab project ID or path"),
    start_date: dt.datetime = Query(..., description="Start date"),
    end_date: dt.datetime = Query(..., description="End date"),
    mongo_db: Database = Depends(get_mongo_database),
    auth_context: AuthContext = Depends(get_auth_context),
) -> UserPerformanceResponse:
    """Return cached performance data if present."""
    try:
        payload = UserPerformanceRequest(
            user_id=user_id,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=", ".join([a["msg"] for a in e.errors()]),
        )

    user = auth_context.gitlab_client.users.get(payload.user_id)

    existing = mongo_db["user_performance"].find_one(
        {
            "username": user.username,
            "project_path_name": payload.project_id,
            "since": str(_to_iso_midnight(payload.start_date)),
            "until": str(_to_iso_midnight(payload.end_date)),
        }
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cached performance data found.",
        )

    return UserPerformanceResponse.model_validate(existing)


@router.post(
    "/projects/{project_id}/users/{user_id}/performance/refresh",
    response_model=UserPerformanceResponse,
    summary="Recalculate and update user performance data",
    responses={
        401: GeneralErrorResponses().UNAUTHORIZED,
        500: GeneralErrorResponses().INTERNAL_SERVER_ERROR,
    },
)
async def refresh_user_performance(
    user_id: int = Path(..., description="GitLab user ID"),
    project_id: str = Path(..., description="GitLab project ID or path"),
    start_date: dt.datetime = Query(..., description="Start date"),
    end_date: dt.datetime = Query(..., description="End date"),
    mongo_db: Database = Depends(get_mongo_database),
    auth_context: AuthContext = Depends(get_auth_context),
) -> UserPerformanceResponse:
    """Recalculate and store fresh performance data."""
    try:
        payload = UserPerformanceRequest(
            user_id=user_id,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=", ".join([a["msg"] for a in e.errors()]),
        )

    user = auth_context.gitlab_client.users.get(payload.user_id)

    try:
        user_performance = get_user_performance_data(
            data=payload,
            user=user,
            mongo_db=mongo_db,
            gitlab=auth_context.gitlab_client,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

    return user_performance

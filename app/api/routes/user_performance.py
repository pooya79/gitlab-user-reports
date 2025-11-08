"""Authentication and GitLab configuration endpoints."""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
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
from app.schemas.user_performance import (
    UserPerformanceRequest,
    UserPerformanceResponse,
)
from app.services import NOW_UTC

router = APIRouter(prefix="/user-performance", tags=["user-performance"])


def _to_date(authored_date) -> dt.date:
    if isinstance(authored_date, dt.datetime):
        return authored_date.date()
    if isinstance(authored_date, str):
        return dt.datetime.fromisoformat(authored_date.replace("Z", "+00:00")).date()
    raise TypeError("Unsupported authored_date type")


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
        until=data.end_date,
        all=True,
        with_stats=True,
    )
    user_commits = [c for c in commits if c.author_email == user.email]

    # Fetching merge request related to each commit
    mr_iids = set()
    mrs: dict[int, gitlab.v4.objects.ProjectMergeRequest] = {}
    mr_to_commit = defaultdict(list)
    for commit in user_commits:
        related_mrs = commit.merge_requests()
        for mr in related_mrs:
            mr_iids.add(mr["iid"])
            mrs[mr["iid"]] = mr
            mr_to_commit[mr["iid"]].append(commit.id)

    # Batch them weekly from the start to end date based on authored_date
    sorted_commits = sorted(user_commits, key=lambda c: _to_date(c.authored_date))

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
        commit_date = _to_date(commit.authored_date).isoformat()
        daily_commit_counts[commit_date] += 1
        daily_additions[commit_date] += commit.stats["additions"]
        daily_deletions[commit_date] += commit.stats["deletions"]
        daily_changes[commit_date] += commit.stats["total"]
        total_commits += 1
        total_additions += commit.stats["additions"]
        total_deletions += commit.stats["deletions"]

    total_mr_contributed = len(mr_iids)
    llm_prompt_suggestion = (
        "Provide insights on the user's code contributions based on the following data."
    )
    prompt_tokens = 0  # Placeholder for actual token calculation
    calculated_at = NOW_UTC()

    for mr in mrs.values():
        merge_requests.append(
            {
                "iid": mr.iid,
                "title": mr.title,
                "web_url": mr.web_url,
                "created_at": mr.created_at,
                "state": mr.state,
                "commits": [
                    commit.title
                    for commit in user_commits
                    if commit.id in mr_to_commit[mr.iid]
                ],
                "commits_count": len(mr_to_commit[mr.iid]),
                "additions": sum(
                    commit.stats["additions"]
                    for commit in user_commits
                    if commit.id in mr_to_commit[mr.iid]
                ),
                "deletions": sum(
                    commit.stats["deletions"]
                    for commit in user_commits
                    if commit.id in mr_to_commit[mr.iid]
                ),
            }
        )

    user_performance = UserPerformanceResponse(
        username=user.username,
        project_path_name=project.path_with_namespace,
        since=_to_date(data.start_date),
        until=_to_date(data.end_date),
        total_commits=total_commits,
        total_additions=total_additions,
        total_deletions=total_deletions,
        total_changes=total_additions + total_deletions,
        total_mr_contributed=total_mr_contributed,
        daily_commit_counts=daily_commit_counts,
        daily_additions=daily_additions,
        daily_deletions=daily_deletions,
        daily_changes=daily_changes,
        merge_requests=merge_requests,
        llm_prompt_suggestion=llm_prompt_suggestion,
        prompt_tokens=prompt_tokens,
        calculated_at=calculated_at,
    )

    # Store the result in MongoDB
    mongo_db["user_performance"].insert_one(user_performance.model_dump())

    return user_performance


@router.get(
    "/projects/{project_id}/users/{user_id}/performance",
    response_model=UserPerformanceResponse,
    summary="Get cached user performance data",
)
async def get_user_performance(
    user_id: int = Path(..., description="GitLab user ID"),
    project_id: str = Path(..., description="GitLab project ID or path"),
    start_date: dt.date = Query(..., description="Start date"),
    end_date: dt.date = Query(..., description="End date"),
    mongo_db: Database = Depends(get_mongo_database),
    auth_context: AuthContext = Depends(get_auth_context),
) -> UserPerformanceResponse:
    """Return cached performance data if present."""
    payload = UserPerformanceRequest(
        user_id=user_id, project_id=project_id, start_date=start_date, end_date=end_date
    )

    user = auth_context.gitlab_client.users.get(payload.user_id)
    if hasattr(user, "email") and not user.email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or has no email.",
        )

    existing = mongo_db["user_performance"].find_one(
        {
            "username": user.username,
            "project_path_name": payload.project_id,
            "since": _to_date(payload.start_date),
            "until": _to_date(payload.end_date),
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
)
async def refresh_user_performance(
    user_id: int = Path(..., description="GitLab user ID"),
    project_id: str = Path(..., description="GitLab project ID or path"),
    start_date: dt.date = Query(..., description="Start date"),
    end_date: dt.date = Query(..., description="End date"),
    mongo_db: Database = Depends(get_mongo_database),
    auth_context: AuthContext = Depends(get_auth_context),
) -> UserPerformanceResponse:
    """Recalculate and store fresh performance data."""
    payload = UserPerformanceRequest(
        user_id=user_id, project_id=project_id, start_date=start_date, end_date=end_date
    )

    user = auth_context.gitlab_client.users.get(payload.user_id)
    if hasattr(user, "email") and not user.email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or has no email.",
        )

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

"""User performance calculation based on timelines endpoints."""

from __future__ import annotations

import datetime as dt
import requests
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
from app.schemas.users import (
    GitLabUser,
    TimelogData,
    TimelogsRequest,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    response_model=list[GitLabUser],
    summary="List GitLab Users",
    responses={
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
        502: GeneralErrorResponses.BAD_GATEWAY,  # GitLab users fetch failure
    },
)
def list_gitlab_users(
    page: int = Query(1, description="Page number for pagination."),
    per_page: int = Query(20, description="Number of users per page."),
    humans: bool = Query(True, description="Whether to include only human users."),
    search: str | None = Query(
        None, description="Search term to filter users by username or name."
    ),
    auth_context: AuthContext = Depends(get_auth_context),
) -> list[GitLabUser]:
    """Retrieve a list of GitLab users with optional search and pagination."""

    try:
        users = auth_context.gitlab_client.users.list(
            page=page,
            per_page=per_page,
            search=search,
            active=True,
            humans=humans,
        )
    except gitlab.GitlabError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch users from GitLab.",
        ) from exc

    return [GitLabUser(**user.__dict__["_attrs"]) for user in users]


@router.get(
    "/{user_id}",
    response_model=GitLabUser,
    responses={
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
        502: GeneralErrorResponses.BAD_GATEWAY,  # GitLab user fetch failure
    },
)
def get_gitlab_user(
    user_id: int = Path(..., description="The ID of the GitLab user to retrieve."),
    auth_context: AuthContext = Depends(get_auth_context),
) -> GitLabUser:
    """Retrieve a GitLab user by their ID."""

    try:
        user = auth_context.gitlab_client.users.get(user_id)
    except gitlab.GitlabError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch user from GitLab.",
        ) from exc

    return GitLabUser(**user.__dict__["_attrs"])


@router.get(
    "/{username}/timelogs",
    response_model=TimelogData,
    responses={
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
        502: GeneralErrorResponses.BAD_GATEWAY,  # GitLab timelogs fetch failure
    },
)
def get_user_timelogs(
    username: str = Path(
        ..., description="The username of the user to retrieve timelogs for."
    ),
    start_time: dt.datetime = Query(
        ..., description="The start date for the timelog period."
    ),
    end_time: dt.datetime = Query(
        ..., description="The end date for the timelog period."
    ),
    first: int = Query(100, description="Number of timelogs to retrieve per page."),
    after: str | None = Query(
        None, description="Cursor for pagination to fetch the next set of timelogs."
    ),
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> TimelogData:
    """Retrieve user timelogs for a specified period."""

    try:
        payload = TimelogsRequest(
            username=username,
            startTime=start_time,
            endTime=end_time,
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=", ".join([a["msg"] for a in e.errors()]),
        )

    user_config = mongo_db["app_user_config"].find_one({})
    gitlab_url = user_config.get("gitlab_url")
    gitlab_token = user_config.get("gitlab_admin_token")
    graph_ql_url = f"{gitlab_url}/api/graphql"

    query = """
    query timeTrackingReport(
        $startTime: Time,
        $endTime: Time,
        $projectId: ProjectID,
        $groupId: GroupID,
        $username: String,
        $first: Int,
        $last: Int,
        $before: String,
        $after: String
        ) {
        timelogs(
            startTime: $startTime
            endTime: $endTime
            projectId: $projectId
            groupId: $groupId
            username: $username
            first: $first
            last: $last
            after: $after
            before: $before
            sort: SPENT_AT_DESC
        ) {
            count
            totalSpentTime
            nodes {
            id
            project {
                id
                webUrl
                fullPath
                nameWithNamespace
            }
            timeSpent
            user {
                id
                name
                username
                avatarUrl
                webPath
            }
            spentAt
            note {
                id
                body
            }
            summary
            issue {
                iid
                title
                webUrl
                state
                reference
            }
            mergeRequest {
                iid
                title
                webUrl
                state
                reference
            }
            }
            pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
            }
        }
        }
    """

    variables = {
        "username": payload.username,
        "startTime": payload.startTime.isoformat(),
        "endTime": payload.endTime.isoformat(),
        "first": first,
        "after": after,
    }

    headers = {
        "Authorization": f"Bearer {gitlab_token}",
        "Content-Type": "application/json",
    }

    response = requests.post(
        graph_ql_url, json={"query": query, "variables": variables}, headers=headers
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch timelogs from GitLab.",
        )
    return TimelogData(**response.json()["data"]["timelogs"])

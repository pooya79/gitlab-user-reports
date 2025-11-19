"""Performance calculation endpoints."""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from pydantic import ValidationError
from fastapi import APIRouter, Path, Query, Depends, HTTPException, status
from fastapi.exceptions import RequestValidationError
from pymongo.database import Database
import gitlab

from app.api.deps import (
    AuthContext,
    get_auth_context,
    get_mongo_database,
)
from app.schemas import GeneralErrorResponses
from app.schemas.performance import (
    UserPerformanceRequest,
    ProjectPerformanceResponse,
    GeneralUserPerformance,
    TimeSpentStats,
)
from app.services.performance import (
    summarize_user_performance,
    get_project_performance_stats,
    get_time_spent_stats,
)
from app.core.config import get_settings

router = APIRouter(prefix="/performance", tags=["performance"])


@router.get(
    "/users/{user_id}",
    response_model=GeneralUserPerformance,
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
    },
)
async def get_user_performance(
    user_id: int = Path(..., description="The ID of the GitLab user."),
    start_date: dt.datetime = Query(
        ..., description="The start date for the performance period in ISO format."
    ),
    end_date: dt.datetime = Query(
        ..., description="The end date for the performance period in ISO format."
    ),
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> GeneralUserPerformance:
    """Calculate and retrieve user performance data over a specified time period."""
    # Validate input data

    try:
        payload = UserPerformanceRequest(
            user_id=user_id, start_date=start_date, end_date=end_date
        )
    except ValidationError as ve:
        raise RequestValidationError(ve.errors(include_url=False, include_input=False))

    # Check cache
    cache_collection = mongo_db["performance_cache"]
    performance_data = cache_collection.find_one(
        {
            "user_id": payload.user_id,
            "type": "general",
            "start_date": payload.start_date,
            "end_date": payload.end_date,
        }
    )

    # Get user performance if no valid cache
    if not performance_data:
        performance_data = await summarize_user_performance(
            gitlab_client=auth_context.gitlab_client,
            user_id=payload.user_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
        )

        # Store in cache
        cache_collection.insert_one(
            {
                "user_id": payload.user_id,
                "type": "general",
                "start_date": payload.start_date,
                "end_date": payload.end_date,
                "data": performance_data.dict(),
                "expires_at": dt.datetime.now(dt.timezone.utc)
                + dt.timedelta(seconds=get_settings().performance_cache_expiry_seconds),
            }
        )
    else:
        performance_data = GeneralUserPerformance(**performance_data["data"])
    return performance_data


@router.get(
    "/project/{project_id}/users/{user_id}",
    response_model=ProjectPerformanceResponse,
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        404: GeneralErrorResponses.NOT_FOUND,
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
    },
)
async def get_project_performance(
    project_id: int = Path(..., description="The ID of the GitLab project."),
    user_id: int = Path(..., description="The ID of the GitLab user."),
    start_date: dt.datetime = Query(
        ..., description="The start date for the performance period in ISO format."
    ),
    end_date: dt.datetime = Query(
        ..., description="The end date for the performance period in ISO format."
    ),
    auth_context: AuthContext = Depends(get_auth_context),
    db: Database = Depends(get_mongo_database),
) -> ProjectPerformanceResponse:
    """Calculate and retrieve project performance data over a specified time period."""
    # Validate input data
    try:
        payload = UserPerformanceRequest(
            user_id=user_id,
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
        )
    except ValidationError as ve:
        raise RequestValidationError(ve.errors(include_url=False, include_input=False))

    # Check cache
    cache_collection = db["performance_cache"]
    performance_data = cache_collection.find_one(
        {
            "user_id": payload.user_id,
            "project_id": payload.project_id,
            "type": "project",
            "start_date": payload.start_date,
            "end_date": payload.end_date,
        }
    )

    # Get project performance if no valid cache
    if performance_data is not None:
        performance_data = ProjectPerformanceResponse(**performance_data["data"])
    else:
        try:
            # Get user email
            user_email = await auth_context.gitlab_client.users.get(
                payload.user_id
            ).email
        except AttributeError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Can't fetch user email for user ID {payload.user_id}, not admin token.",
            ) from e

        # Get project performance
        performance_data = await get_project_performance_stats(
            gitlab_client=auth_context.gitlab_client,
            user_email=user_email,
            project_id=project_id,
            since=payload.start_date,
            until=payload.end_date,
        )
    return performance_data

@router.get(
    "users/{user_id}/time-spent",
    response_model=TimeSpentStats,
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        404: GeneralErrorResponses.NOT_FOUND,
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
    },
)
async def get_time_spent_statistics(
    user_id: int = Path(..., description="The ID of the GitLab user."),
    start_date: dt.datetime = Query(
        ..., description="The start date for the time spent period in ISO format."
    ),
    end_date: dt.datetime = Query(
        ..., description="The end date for the time spent period in ISO format."
    ),
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> TimeSpentStats:
    """Retrieve time spent statistics for a user over a specified time period."""
    # Validate input data
    try:
        payload = UserPerformanceRequest(
            user_id=user_id, start_date=start_date, end_date=end_date
        )
    except ValidationError as ve:
        raise RequestValidationError(ve.errors(include_url=False, include_input=False))
    
    # Check cache
    cache_collection = mongo_db["performance_cache"]
    time_spent_data = cache_collection.find_one(
        {
            "user_id": payload.user_id,
            "type": "time_spent",
            "start_date": payload.start_date,
            "end_date": payload.end_date,
        }
    )
    
    if time_spent_data:
        return TimeSpentStats(**time_spent_data["data"])
    
    # Get username
    try:
        user = auth_context.gitlab_client.users.get(payload.user_id)
        username = user.username
    except AttributeError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Can't fetch username for user ID {payload.user_id}, not admin token.",
        ) from e

    # Get time spent statistics
    time_spent_stats = await get_time_spent_stats(
        gitlab_client=auth_context.gitlab_client,
        username=username,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    return time_spent_stats

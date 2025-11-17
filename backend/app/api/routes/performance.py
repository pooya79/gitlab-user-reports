"""Performance calculation endpoints."""

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
from app.schemas.performance import (
    ProjectInfo,
    UserPerformanceRequest,
    GeneralUserPerformance,
    TimeSpentStats,
)
from app.services.performance import summarize_user_performance
from app.core.config import get_settings
from app.core.promtps import USER_PERFORMANCE_TEMPLATE

router = APIRouter(prefix="/performance", tags=["performance"])


@router.post(
    "/user/{user_id}",
    response_model=GeneralUserPerformance,
    responses={
        401: GeneralErrorResponses().UNAUTHORIZED,
        500: GeneralErrorResponses().INTERNAL_SERVER_ERROR,
    },
)
async def refresh_user_performance(
    user_id: int = Path(..., description="The ID of the GitLab user."),
    start_date: dt.datetime = Query(
        ..., description="The start date for the performance period in ISO format."
    ),
    end_date: dt.datetime = Query(
        ..., description="The end date for the performance period in ISO format."
    ),
    auth_context: AuthContext = Depends(get_auth_context),
    db: Database = Depends(get_mongo_database),
) -> GeneralUserPerformance:
    """Calculate and retrieve user performance data over a specified time period."""

    # Validate input data
    try:
        user_performance_request = UserPerformanceRequest(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )
        validated_data = user_performance_request.validate_time_interval()
    except ValidationError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )

    # Calculate performance
    try:
        return await summarize_user_performance(
            gitlab_client=auth_context.gitlab_client,
            user_id=validated_data.user_id,
            start_date=validated_data.start_date,
            end_date=validated_data.end_date,
        )
        # store in db
        # TODO
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to calculate user performance.",
        ) from exc


@router.get(
    "/user/{user_id}",
    response_model=GeneralUserPerformance,
    responses={
        401: GeneralErrorResponses().UNAUTHORIZED,
        500: GeneralErrorResponses().INTERNAL_SERVER_ERROR,
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
    db: Database = Depends(get_mongo_database),
) -> GeneralUserPerformance:
    """Get cached user performance data over a specified time period."""
    pass  # TODO: implement caching and retrieval logic

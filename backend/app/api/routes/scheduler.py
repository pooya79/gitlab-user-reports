"""Endpoints for configuring scheduled performance email reports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import gitlab
from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Response,
    status,
)
from pymongo.database import Database

from app.api.deps import AuthContext, get_auth_context, get_mongo_database
from app.schemas import GeneralErrorResponses
from app.schemas.scheduler import (
    ScheduledReportCreate,
    ScheduledReportResponse,
    ScheduledReportUpdate,
)
from app.services.scheduler import next_run_time, run_schedule_now

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


def _parse_object_id(schedule_id: str) -> ObjectId:
    try:
        return ObjectId(schedule_id)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_schedule_id",
        ) from exc


def _serialize_schedule(doc: dict[str, Any]) -> ScheduledReportResponse:
    return ScheduledReportResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        to=doc.get("to", []),
        cc=doc.get("cc", []),
        bcc=doc.get("bcc", []),
        subject=doc.get("subject"),
        day_of_week=doc.get("day_of_week", "mon"),
        hour_utc=doc.get("hour_utc", 7),
        minute_utc=doc.get("minute_utc", 0),
        active=doc.get("active", True),
        last_sent_at=doc.get("last_sent_at"),
        last_error=doc.get("last_error"),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        next_run_at=next_run_time(doc),
    )


@router.get(
    "/reports",
    response_model=list[ScheduledReportResponse],
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
    },
)
async def list_schedules(
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> list[ScheduledReportResponse]:
    """List all configured schedules."""

    docs = mongo_db["scheduled_reports"].find({})
    return [_serialize_schedule(doc) for doc in docs]


@router.get(
    "/reports/{schedule_id}",
    response_model=ScheduledReportResponse,
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        404: GeneralErrorResponses.NOT_FOUND,
    },
)
async def get_schedule(
    schedule_id: str = Path(..., description="Mongo ObjectId of the schedule"),
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> ScheduledReportResponse:
    """Fetch a single schedule."""

    oid = _parse_object_id(schedule_id)
    doc = mongo_db["scheduled_reports"].find_one({"_id": oid})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="schedule_not_found"
        )
    return _serialize_schedule(doc)


@router.post(
    "/reports",
    response_model=ScheduledReportResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        404: GeneralErrorResponses.NOT_FOUND,
        502: GeneralErrorResponses.BAD_GATEWAY,
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
    },
)
async def create_schedule(
    payload: ScheduledReportCreate,
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> ScheduledReportResponse:
    """Create a scheduled weekly report."""

    try:
        auth_context.gitlab_client.users.get(payload.user_id)
    except gitlab.GitlabGetError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found"
        ) from exc
    except gitlab.GitlabError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="gitlab_unavailable",
        ) from exc

    now = datetime.now(timezone.utc)
    schedule_doc = {
        "user_id": payload.user_id,
        "to": payload.to,
        "cc": payload.cc,
        "bcc": payload.bcc,
        "subject": payload.subject,
        "day_of_week": payload.day_of_week,
        "hour_utc": payload.hour_utc,
        "minute_utc": payload.minute_utc,
        "active": payload.active,
        "created_at": now,
        "updated_at": now,
        "last_sent_at": None,
        "last_error": None,
        "manual_trigger_at": None,
    }

    result = mongo_db["scheduled_reports"].insert_one(schedule_doc)
    schedule_doc["_id"] = result.inserted_id
    return _serialize_schedule(schedule_doc)


@router.put(
    "/reports/{schedule_id}",
    response_model=ScheduledReportResponse,
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        404: GeneralErrorResponses.NOT_FOUND,
    },
)
async def update_schedule(
    schedule_id: str,
    payload: ScheduledReportUpdate,
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> ScheduledReportResponse:
    """Update an existing scheduled report."""

    oid = _parse_object_id(schedule_id)
    schedule = mongo_db["scheduled_reports"].find_one({"_id": oid})
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="schedule_not_found"
        )

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        return _serialize_schedule(schedule)

    if "to" in update_data and not update_data["to"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="recipients_required",
        )

    now = datetime.now(timezone.utc)
    update_data["updated_at"] = now

    mongo_db["scheduled_reports"].update_one({"_id": oid}, {"$set": update_data})
    schedule.update(update_data)
    return _serialize_schedule(schedule)


@router.delete(
    "/reports/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        404: GeneralErrorResponses.NOT_FOUND,
    },
)
async def delete_schedule(
    schedule_id: str,
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> Response:
    """Delete a schedule and remove its job."""

    oid = _parse_object_id(schedule_id)
    result = mongo_db["scheduled_reports"].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="schedule_not_found"
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/reports/{schedule_id}/send-now",
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        404: GeneralErrorResponses.NOT_FOUND,
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
    },
)
async def send_schedule_now(
    schedule_id: str,
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> dict[str, str]:
    """Trigger a scheduled report immediately."""

    oid = _parse_object_id(schedule_id)
    schedule = mongo_db["scheduled_reports"].find_one({"_id": oid})
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="schedule_not_found"
        )

    run_schedule_now(schedule_id)
    return {"detail": "queued"}

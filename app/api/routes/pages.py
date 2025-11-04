"""Server-rendered page routes."""

from datetime import datetime

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.frontend import templates
from app.schemas import UserRead
from app.services import user_service

router = APIRouter(tags=["pages"])


@router.get("/", response_class=HTMLResponse)
async def index(
    request: Request, db: Session = Depends(get_db_session)
) -> HTMLResponse:
    """Render the home page with a user roster."""

    users = [UserRead.model_validate(user) for user in user_service.list_users(db)]
    context = {
        "request": request,
        "users": users,
        "title": "FastAPI Fullstack Starter",
        "year": datetime.utcnow().year,
    }
    return templates.TemplateResponse("index.html", context)

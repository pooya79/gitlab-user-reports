"""Authentication and GitLab configuration endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pymongo.database import Database

from app.api.deps import (
    AuthContext,
    get_app_settings,
    get_auth_context,
    get_mongo_database,
)
from app.core.config import Settings
from app.db.types import AppUserConfig, AuthSession
from app.schemas import GeneralErrorResponses
from app.schemas.auth import (
    GitLabConfigRequest,
    GitLabConfigResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    UserProfileResponse,
)
from app.services import NOW_UTC
from app.services.gitlab import GitLabTokenError, validate_gitlab_admin_token
from app.services.security import create_access_token


router = APIRouter(prefix="/auth", tags=["auth"])


def _ensure_gitlab_payload_coherence(payload: LoginRequest) -> None:
    """Ensure both GitLab fields are present if either is provided."""

    has_url = payload.gitlab_url is not None
    has_token = payload.gitlab_admin_token is not None
    if has_url != has_token:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="gitlab_config_incomplete",
        )


@router.post(
    "/login",
    response_model=LoginResponse,
    responses={
        401: GeneralErrorResponses().UNAUTHORIZED,
        400: GeneralErrorResponses().BAD_REQUEST,
    },
)
async def login(
    payload: LoginRequest,
    request: Request,
    mongo_db: Database = Depends(get_mongo_database),
    settings: Settings = Depends(get_app_settings),
    user_agent: str | None = Header(
        default=None, convert_underscores=False, alias="User-Agent"
    ),
) -> LoginResponse:
    """Authenticate the sole application user, provisioning if necessary."""

    users = mongo_db["app_user_config"]
    sessions = mongo_db["auth_session"]

    config = users.find_one({})
    gitlab_user_info = None

    if config is None:
        _ensure_gitlab_payload_coherence(payload)

        if payload.gitlab_url and payload.gitlab_admin_token:
            try:
                gitlab_user_info, _ = validate_gitlab_admin_token(
                    gitlab_url=str(payload.gitlab_url),
                    admin_token=payload.gitlab_admin_token,
                )
            except GitLabTokenError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                ) from exc

        password = payload.password  # No need to hash, since one user only
        app_user = AppUserConfig(
            username=payload.username,
            password=password,
            gitlab_url=str(payload.gitlab_url) if payload.gitlab_url else None,
            gitlab_admin_token=payload.gitlab_admin_token,
            gitlab_user_info=gitlab_user_info,
            updated_at=NOW_UTC(),
        )
        config = app_user.to_document()
        users.insert_one(config)
    else:
        if config.get("username") != payload.username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Wrong username",
            )
        if payload.password != config.get("password", ""):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Wrong password",
            )
        gitlab_user_info = config.get("gitlab_user_info")

        if payload.gitlab_url or payload.gitlab_admin_token:
            _ensure_gitlab_payload_coherence(payload)
            try:
                gitlab_user_info, _ = validate_gitlab_admin_token(
                    gitlab_url=str(payload.gitlab_url),
                    admin_token=payload.gitlab_admin_token or "",
                )
            except GitLabTokenError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                ) from exc

            update_payload = {
                "gitlab_url": str(payload.gitlab_url),
                "gitlab_admin_token": payload.gitlab_admin_token,
                "gitlab_user_info": gitlab_user_info,
                "updated_at": NOW_UTC(),
            }
            users.update_one({"username": config["username"]}, {"$set": update_payload})
            config.update(update_payload)

    token, issued_at, expires_at, jti = create_access_token(
        settings=settings,
        subject=config["username"],
    )
    session_record = AuthSession(
        username=config["username"],
        jti=jti,
        issued_at=issued_at,
        expires_at=expires_at,
        ip=request.client.host if request.client else None,
        user_agent=user_agent,
    )
    sessions.insert_one(session_record.to_document())

    return LoginResponse(
        access_token=token,
        username=config["username"],
        expires_at=expires_at,
        gitlab_configured=bool(config.get("gitlab_admin_token")),
        gitlab_user_info=gitlab_user_info,
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> LogoutResponse:
    """Invalidate the currently active session."""

    mongo_db["auth_session"].update_one(
        {"jti": auth_context.session["jti"]},
        {"$set": {"revoked": True, "revoked_at": NOW_UTC()}},
    )
    return LogoutResponse()


@router.post(
    "/gitlab",
    response_model=GitLabConfigResponse,
    responses={
        400: GeneralErrorResponses().BAD_REQUEST,
    },
)
async def update_gitlab_configuration(
    payload: GitLabConfigRequest,
    auth_context: AuthContext = Depends(get_auth_context),
    mongo_db: Database = Depends(get_mongo_database),
) -> GitLabConfigResponse:
    """Update the GitLab admin token and store user metadata."""

    try:
        gitlab_user_info, _ = validate_gitlab_admin_token(
            gitlab_url=str(payload.gitlab_url),
            admin_token=payload.gitlab_admin_token,
        )
    except GitLabTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    mongo_db["app_user_config"].update_one(
        {"username": auth_context.username},
        {
            "$set": {
                "gitlab_url": str(payload.gitlab_url),
                "gitlab_admin_token": payload.gitlab_admin_token,
                "gitlab_user_info": gitlab_user_info,
                "updated_at": NOW_UTC(),
            }
        },
    )

    return GitLabConfigResponse(
        gitlab_user_info=gitlab_user_info,
        gitlab_url=payload.gitlab_url,
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_profile(
    auth_context: AuthContext = Depends(get_auth_context),
) -> UserProfileResponse:
    """Return the authenticated user's profile information."""

    return UserProfileResponse(
        username=auth_context.username,
        gitlab_user_info=auth_context.gitlab_user_info,
        gitlab_url=auth_context.user_config.get("gitlab_url"),
    )

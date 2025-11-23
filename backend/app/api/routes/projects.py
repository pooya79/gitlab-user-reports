"""Gitlab resource endpoints."""

from __future__ import annotations

from fastapi import (
    APIRouter,
    Path,
    Query,
    Depends,
    HTTPException,
    status,
)
import gitlab

from app.api.deps import (
    AuthContext,
    get_auth_context,
)
from app.schemas import GeneralErrorResponses
from app.schemas.projects import MembersResponse, ProjectsResponse
from app.core.config import get_settings

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get(
    "/{project_id}/members",
    response_model=list[MembersResponse],
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        404: GeneralErrorResponses.NOT_FOUND,
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
    },
)
def get_project_members(
    project_id: int = Path(..., description="GitLab project ID"),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    per_page: int = Query(20, ge=1, le=100, description="Number of members per page"),
    search: str | None = Query(None, description="Filter members by username or name"),
    auth_context: AuthContext = Depends(get_auth_context),
) -> list[MembersResponse]:
    """Get members of a GitLab project."""
    gitlab_client = auth_context.gitlab_client
    try:
        project = gitlab_client.projects.get(project_id)
        members = project.members.list(
            per_page=per_page, page=page, query=search, humans=True
        )
    except gitlab.exceptions.GitlabGetError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found.",
        ) from e

    access_level_mapping = get_settings().gitlab_access_level_mapping
    return [
        MembersResponse(
            id=member.id,
            username=member.username,
            name=member.name,
            web_url=member.web_url,
            avatar_url=member.avatar_url,
            state=member.state,
            access_level=member.access_level,
            access_level_name=access_level_mapping.get(member.access_level, "Unknown"),
        )
        for member in members
    ]


@router.get(
    "/",
    response_model=list[ProjectsResponse],
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
        502: GeneralErrorResponses.BAD_GATEWAY,
    },
)
def list_projects(
    page: int = Query(1, ge=1, description="Page number for pagination"),
    per_page: int = Query(20, ge=1, le=100, description="Number of projects per page"),
    search: str | None = Query(None, description="Filter projects by name or path"),
    membership: bool | None = Query(
        None,
        description="Only return projects the authenticated user is a member of",
    ),
    auth_context: AuthContext = Depends(get_auth_context),
) -> list[ProjectsResponse]:
    """List GitLab projects with optional search filtering."""
    gitlab_client = auth_context.gitlab_client
    list_kwargs: dict[str, object] = {
        "page": page,
        "per_page": per_page,
        "order_by": "last_activity_at",
        "sort": "desc",
    }
    if search:
        list_kwargs["search"] = search
    if membership is not None:
        list_kwargs["membership"] = membership

    try:
        projects = gitlab_client.projects.list(**list_kwargs)
    except gitlab.exceptions.GitlabListError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to fetch projects from GitLab.",
        ) from exc

    return [
        ProjectsResponse(
            id=project.id,
            name=project.name,
            name_with_namespace=project.name_with_namespace,
            path_with_namespace=project.path_with_namespace,
            tag_list=getattr(project, "tag_list", []),
            topics=getattr(project, "topics", []),
            web_url=project.web_url,
            avatar_url=getattr(project, "avatar_url", None),
            created_at=project.created_at,
        )
        for project in projects
    ]


@router.get(
    "/{project_id}",
    response_model=ProjectsResponse,
    responses={
        401: GeneralErrorResponses.UNAUTHORIZED,
        404: GeneralErrorResponses.NOT_FOUND,
        500: GeneralErrorResponses.INTERNAL_SERVER_ERROR,
    },
)
def get_project(
    project_id: int = Path(..., description="GitLab project ID"),
    auth_context: AuthContext = Depends(get_auth_context),
) -> ProjectsResponse:
    """Get details of a specific GitLab project."""
    gitlab_client = auth_context.gitlab_client
    try:
        project = gitlab_client.projects.get(project_id)
    except gitlab.exceptions.GitlabGetError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found.",
        ) from e

    return ProjectsResponse(
        id=project.id,
        name=project.name,
        name_with_namespace=project.name_with_namespace,
        path_with_namespace=project.path_with_namespace,
        tag_list=getattr(project, "tag_list", []),
        topics=getattr(project, "topics", []),
        web_url=project.web_url,
        avatar_url=getattr(project, "avatar_url", None),
        created_at=project.created_at,
    )

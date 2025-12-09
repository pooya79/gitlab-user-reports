"""Aggregate GitLab commit/review data into developer performance metrics."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import Iterable, Any
import requests
import json
from pydantic import ValidationError

import gitlab
from gitlab.exceptions import GitlabError

from app.core.config import get_settings
from app.schemas.performance import (
    extract_numeric_id,
    IssueInfo,
    MergeRequestInfo,
    ProjectInfo,
    CommitInfo,
    MergeRequestDetails,
    ProjectPerformanceResponse,
    ProjectPerformanceShort,
    TimelogNode,
    ProjectTimelogs,
    TimeSpentStats,
    CodeReviewStats,
    GeneralUserPerformance,
    ProjectContributorStats,
    GeneralProjectPerformance,
)

_UTC = timezone.utc


class PerformanceComputationError(RuntimeError):
    """Raised when GitLab data cannot be aggregated."""


def _to_date(dt_obj: datetime) -> datetime:
    """Convert a datetime to a date with time set to midnight UTC."""
    return datetime(dt_obj.year, dt_obj.month, dt_obj.day, tzinfo=_UTC)


def _parse_gitlab_datetime(value: str) -> datetime:
    """Convert GitLab ISO datetime strings into aware UTC datetime (normalize to midnight)."""
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=_UTC)
    return _to_date(parsed.astimezone(_UTC))


def _fetch_user_events(
    *,
    user: gitlab.v4.objects.User,
    start: datetime,
    end: datetime,
) -> list[gitlab.v4.objects.Event]:
    """Load all events for the user within the provided window."""
    try:
        return user.events.list(
            after=start.isoformat(),
            before=end.isoformat(),
            sort="asc",
            get_all=True,
        )
    except GitlabError as exc:
        raise PerformanceComputationError("Failed to fetch user events") from exc


def _summarize_events(
    events: Iterable[gitlab.v4.objects.Event],
) -> tuple[CodeReviewStats, set[int]]:
    approvals = 0
    review_comments = 0
    notes_authored = 0
    reviewed_merge_requests: set[tuple[int | None, int | None]] = set()
    project_ids: set[int] = set()

    for event in events:
        action = (getattr(event, "action_name", "") or "").lower()
        target_type = (getattr(event, "target_type", "") or "").lower()
        project_id = getattr(event, "project_id", None)
        target_id = getattr(event, "target_id", None)

        if project_id is not None:
            project_ids.add(project_id)

        if "approve" in action:
            approvals += 1
            if target_type == "merge_request":
                reviewed_merge_requests.add((project_id, target_id))

        if "comment" in action or target_type == "note":
            notes_authored += 1
            if target_type == "merge_request":
                review_comments += 1
                reviewed_merge_requests.add((project_id, target_id))

    reviewed_pairs = {
        (pid, tid)
        for pid, tid in reviewed_merge_requests
        if pid is not None and tid is not None
    }

    code_reviews = CodeReviewStats(
        approvals_given=approvals,
        review_comments=review_comments,
        reviewed_merge_requests=len(reviewed_pairs),
        notes_authored=notes_authored,
    )

    return code_reviews, project_ids


def get_project_performance_stats(
    gitlab_client: gitlab.Gitlab,
    user_emails: str | list[str],
    project_id: int,
    since: datetime,
    until: datetime,
) -> ProjectPerformanceResponse:
    """Collect performance stats for a specific project."""
    if isinstance(user_emails, str):
        user_emails = [user_emails]

    # Fetch project
    try:
        project = gitlab_client.projects.get(project_id)
    except GitlabError as exc:
        raise PerformanceComputationError(
            f"Failed to load project with ID {project_id}"
        ) from exc

    # Fetch commits by the user_emails (A user can have multiple emails that have committed by)
    try:
        commits = []
        for user_email in user_emails:
            commits.extend(
                project.commits.list(
                    all=True,
                    get_all=True,
                    since=since.isoformat(),
                    until=(
                        until + timedelta(days=get_settings().safe_date_offset)
                    ).isoformat(),
                    author=user_email,
                    with_stats=True,
                )
            )
        user_commits = [
            commit
            for commit in commits
            if commit.author_email in user_emails
            and _parse_gitlab_datetime(commit.authored_date) >= since
            and _parse_gitlab_datetime(commit.authored_date) <= until
            and len(commit.parent_ids) < 2  # Exclude merge commits
        ]
    except GitlabError as exc:
        raise PerformanceComputationError(
            f"Failed to fetch commits for project ID {project_id}"
        ) from exc

    # Sort commits by authored date
    sorted_commits = sorted(
        user_commits,
        key=lambda c: _parse_gitlab_datetime(c.authored_date),
    )

    # mr_iid -> (mr_details_dict, [commit_ids_for_this_user])
    merge_requests: dict[int, tuple[dict, list[str]]] = {}

    total_additions = 0
    total_deletions = 0

    daily_commit_counts: dict[datetime, int] = defaultdict(int)
    daily_additions: dict[datetime, int] = defaultdict(int)
    daily_deletions: dict[datetime, int] = defaultdict(int)
    daily_changes: dict[datetime, int] = defaultdict(int)

    for commit in sorted_commits:
        stats = commit.stats or {}
        num_additions = stats.get("additions", 0)
        num_deletions = stats.get("deletions", 0)

        total_additions += num_additions
        total_deletions += num_deletions

        authored_dt = _parse_gitlab_datetime(commit.authored_date)
        # If you prefer day-level buckets, use authored_dt.date() instead
        daily_commit_counts[authored_dt] += 1
        daily_additions[authored_dt] += num_additions
        daily_deletions[authored_dt] += num_deletions
        daily_changes[authored_dt] += num_additions + num_deletions

        # Collect MRs per commit
        try:
            mrs = commit.merge_requests()
            for mr in mrs:
                mr_iid = int(mr["iid"])
                if mr_iid not in merge_requests:
                    merge_requests[mr_iid] = (mr, [])
                merge_requests[mr_iid][1].append(commit.id)
        except GitlabError as exc:
            raise PerformanceComputationError(
                f"Failed to fetch merge requests for project ID {project_id}"
            ) from exc

    total_commits = len(user_commits)
    total_changes = total_additions + total_deletions

    merge_request_details: list[MergeRequestDetails] = []

    for mr_details, commit_ids in merge_requests.values():
        # User's commits in this MR
        mr_user_commits = [commit for commit in user_commits if commit.id in commit_ids]

        mr_total_additions = sum(
            (commit.stats or {}).get("additions", 0) for commit in mr_user_commits
        )
        mr_total_deletions = sum(
            (commit.stats or {}).get("deletions", 0) for commit in mr_user_commits
        )

        merge_request_details.append(
            MergeRequestDetails(
                iid=str(mr_details["iid"]),
                title=mr_details["title"],
                description=mr_details.get("description") or "",
                web_url=mr_details["web_url"],
                state=mr_details["state"],
                reference=(
                    mr_details.get("reference")
                    or mr_details.get("references", {}).get("full", "")
                ),
                created_at=_parse_gitlab_datetime(mr_details["created_at"]),
                total_commits=len(mr_user_commits),
                total_additions=mr_total_additions,
                total_deletions=mr_total_deletions,
                commits_count=mr_details.get("commits_count", len(mr_user_commits)),
                commits=[
                    CommitInfo(
                        title=commit.title,
                        message=commit.message,
                        web_url=commit.web_url,
                        authored_date=_parse_gitlab_datetime(commit.authored_date),
                        additions=(commit.stats or {}).get("additions", 0),
                        deletions=(commit.stats or {}).get("deletions", 0),
                    )
                    for commit in mr_user_commits
                ]
                or None,
            )
        )

    return ProjectPerformanceResponse(
        id=project.id,
        name=project.name,
        avatar_url=getattr(project, "avatar_url", None),
        web_url=project.web_url,
        path_with_namespace=project.path_with_namespace,
        name_with_namespace=project.name_with_namespace,
        since=since,
        until=until,
        commits=total_commits,
        additions=total_additions,
        deletions=total_deletions,
        changes=total_changes,
        mr_contributed=len(merge_requests),
        calculated_at=datetime.now(_UTC),
        merge_requests=merge_request_details or None,
        # ProjectPerformanceResponse extra fields
        user_email=user_email,
        daily_commit_counts=dict(daily_commit_counts),
        daily_additions=dict(daily_additions),
        daily_deletions=dict(daily_deletions),
        daily_changes=dict(daily_changes),
    )


def get_time_spent_stats(
    gitlab_token: str,
    gitlab_base_url: str,
    username: str,
    start_time: datetime,
    end_time: datetime,
    first: int = 100,
    after: str | None = None,
) -> TimeSpentStats:
    """Collect time spent statistics for the user."""

    graph_ql_url = f"{gitlab_base_url}/api/graphql"

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
                    name
                    avatarUrl
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

    headers = {
        "Authorization": f"Bearer {gitlab_token}",
        "Content-Type": "application/json",
    }

    all_nodes: list[dict] = []
    total_spent_seconds = 0

    cursor = after
    while True:
        variables = {
            "username": username,
            "startTime": start_time.isoformat(),
            "endTime": end_time.isoformat(),
            "first": first,
            "after": cursor,
            "projectId": None,
            "groupId": None,
            "last": None,
            "before": None,
        }

        try:
            response = requests.post(
                graph_ql_url,
                json={"query": query, "variables": variables},
                headers=headers,
            )
        except requests.RequestException as exc:
            raise PerformanceComputationError(
                "Failed to fetch time spent data"
            ) from exc

        if response.status_code != 200:
            raise PerformanceComputationError(
                f"GraphQL query failed with status code {response.status_code}"
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise PerformanceComputationError(
                "Invalid JSON response from GitLab"
            ) from exc

        if "errors" in payload:
            raise PerformanceComputationError(
                f"GraphQL returned errors: {payload['errors']}"
            )

        data = payload.get("data", {})
        timelogs_data = data.get("timelogs")
        if timelogs_data is None:
            # No timelogs field at all → treat as empty
            break

        nodes = timelogs_data.get("nodes") or []
        all_nodes.extend(nodes)

        total_spent_seconds += int(timelogs_data.get("totalSpentTime") or 0)

        page_info = timelogs_data.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break

        cursor = page_info.get("endCursor")
        if not cursor:
            break

    # No timelogs → return empty stats
    if not all_nodes:
        return TimeSpentStats(
            user_id=0,
            username=username,
            daily_project_time_spent=[],
            total_time_spent_hours=0.0,
            mr_contributed=0,
            issue_contributed=0,
            project_timelogs=[],
        )

    # Build TimelogNode objects
    timelog_nodes: list[TimelogNode] = []

    for node in all_nodes:
        project_raw = node.get("project") or {}

        project = ProjectInfo(
            id=project_raw.get("id"),
            name=(project_raw.get("name") or "Not provided"),
            avatar_url=project_raw.get("avatarUrl"),
            web_url=project_raw.get("webUrl"),
            path_with_namespace=project_raw.get("fullPath"),
            name_with_namespace=project_raw.get("nameWithNamespace"),
        )

        issue_obj = None
        if node.get("issue"):
            issue_raw = node["issue"]
            issue_obj = IssueInfo(
                iid=issue_raw.get("iid"),
                title=issue_raw.get("title"),
                web_url=issue_raw.get("webUrl"),
                state=issue_raw.get("state"),
                reference=issue_raw.get("reference"),
            )

        mr_obj = None
        if node.get("mergeRequest"):
            mr_raw = node["mergeRequest"]
            mr_obj = MergeRequestInfo(
                iid=mr_raw.get("iid"),
                title=mr_raw.get("title"),
                web_url=mr_raw.get("webUrl"),
                state=mr_raw.get("state"),
                reference=mr_raw.get("reference"),
            )

        try:
            timelog = TimelogNode(
                id=node.get("id"),
                project=project,
                time_spent=node.get("timeSpent") or 0,
                spent_at=node.get("spentAt"),
                summary=node.get("summary"),
                issue=issue_obj,
                merge_request=mr_obj,
            )
        except ValidationError as exc:
            # Skip malformed nodes rather than failing the whole computation
            # (or log this somewhere if you prefer)
            continue

        timelog_nodes.append(timelog)

    if not timelog_nodes:
        return TimeSpentStats(
            user_id=0,
            username=username,
            daily_project_time_spent=[],
            total_time_spent_hours=0.0,
            mr_contributed=0,
            issue_contributed=0,
            project_timelogs=[],
        )

    # User ID from first timelog's user
    first_user = all_nodes[0].get("user") or {}
    user_id = extract_numeric_id(first_user.get("id", "0"))

    # Aggregate: daily_project_time_spent
    # key: (date, project_fullpath) → hours
    daily_proj_hours: dict[tuple[datetime, str], float] = defaultdict(float)

    for tl in timelog_nodes:
        # group by UTC date (drop time)
        day = tl.spent_at.date()
        # Represent as datetime at midnight UTC for the model's datetime type
        day_dt = datetime(day.year, day.month, day.day, tzinfo=tl.spent_at.tzinfo)
        hours = tl.time_spent / 3600.0
        daily_proj_hours[(day_dt, tl.project.path_with_namespace)] += hours

    daily_project_time_spent: list[tuple[datetime, str, float]] = [
        (day_dt, project_fullpath, hours)
        for (day_dt, project_fullpath), hours in sorted(
            daily_proj_hours.items(), key=lambda x: (x[0][0], x[0][1])
        )
    ]

    # Aggregate: project_timelogs
    project_groups: dict[int, list[TimelogNode]] = defaultdict(list)
    project_info_map: dict[int, ProjectInfo] = {}

    for tl in timelog_nodes:
        pid = tl.project.id
        project_groups[pid].append(tl)
        project_info_map[pid] = tl.project

    project_timelogs: list[ProjectTimelogs] = []
    for pid, tls in project_groups.items():
        total_hours = sum(tl.time_spent for tl in tls) / 3600.0
        # sort timelogs by spent_at descending
        tls_sorted = sorted(tls, key=lambda x: x.spent_at, reverse=True)
        project_timelogs.append(
            ProjectTimelogs(
                project=project_info_map[pid],
                timelogs=tls_sorted,
                total_time_spent_hours=total_hours,
            )
        )

    # Unique issues / MRs contributed to
    issue_ids = {
        (tl.issue.reference if tl.issue else None)
        for tl in timelog_nodes
        if tl.issue is not None
    }
    issue_ids.discard(None)

    mr_ids = {
        (tl.merge_request.reference if tl.merge_request else None)
        for tl in timelog_nodes
        if tl.merge_request is not None
    }
    mr_ids.discard(None)

    # Total hours (prefer GraphQL aggregate if available, otherwise recompute)
    if total_spent_seconds == 0:
        total_spent_seconds = sum(tl.time_spent for tl in timelog_nodes)

    total_time_spent_hours = total_spent_seconds / 3600.0

    return TimeSpentStats(
        user_id=user_id,
        username=username,
        daily_project_time_spent=daily_project_time_spent,
        total_time_spent_hours=total_time_spent_hours,
        mr_contributed=len(mr_ids),
        issue_contributed=len(issue_ids),
        project_timelogs=project_timelogs,
    )


def summarize_user_performance(
    *,
    gitlab_client: gitlab.Gitlab,
    user_id: int,
    start_date: datetime,
    end_date: datetime,
    additional_user_emails: list[str] = [],
) -> GeneralUserPerformance:
    """Build an aggregated view of a developer's performance across projects."""
    user = gitlab_client.users.get(user_id)
    user_emails = [user.email] + additional_user_emails

    # Fetch and summarize events
    events = _fetch_user_events(user=user, start=start_date, end=end_date)
    code_review_stats, involved_project_ids = _summarize_events(events)

    # Gather project-specific performance data
    project_performances: list[ProjectPerformanceResponse] = []
    total_commits = 0
    total_additions = 0
    total_deletions = 0
    daily_commit_counts: dict[datetime, int] = defaultdict(int)
    daily_additions: dict[str, int] = defaultdict(int)
    daily_deletions: dict[str, int] = defaultdict(int)
    daily_changes: dict[str, int] = defaultdict(int)
    for project_id in involved_project_ids:
        project_stats = get_project_performance_stats(
            gitlab_client=gitlab_client,
            user_emails=user_emails,
            project_id=project_id,
            since=start_date,
            until=end_date,
        )
        project_performances.append(project_stats)

        total_commits += project_stats.commits
        total_additions += project_stats.additions
        total_deletions += project_stats.deletions

        for date, count in project_stats.daily_commit_counts.items():
            daily_commit_counts[date] += count
        for date, adds in project_stats.daily_additions.items():
            daily_additions[date] += adds
        for date, dels in project_stats.daily_deletions.items():
            daily_deletions[date] += dels
        for date, changes in project_stats.daily_changes.items():
            daily_changes[date] += changes

    total_changes = total_additions + total_deletions

    return GeneralUserPerformance(
        userd_id=user.id,
        username=user.username,
        commits=total_commits,
        additions=total_additions,
        deletions=total_deletions,
        changes=total_changes,
        mr_contributed=sum(pp.mr_contributed for pp in project_performances),
        approvals_given=code_review_stats.approvals_given,
        review_merge_requests=code_review_stats.reviewed_merge_requests,
        review_comments=code_review_stats.review_comments,
        notes_authored=code_review_stats.notes_authored,
        daily_commit_counts=dict(daily_commit_counts),
        daily_additions=dict(daily_additions),
        daily_deletions=dict(daily_deletions),
        daily_changes=dict(daily_changes),
        project_performances=[
            ProjectPerformanceShort(
                id=pp.id,
                name=pp.name,
                avatar_url=pp.avatar_url,
                web_url=pp.web_url,
                path_with_namespace=pp.path_with_namespace,
                name_with_namespace=pp.name_with_namespace,
                since=pp.since,
                until=pp.until,
                commits=pp.commits,
                additions=pp.additions,
                deletions=pp.deletions,
                changes=pp.changes,
                mr_contributed=pp.mr_contributed,
                calculated_at=pp.calculated_at,
                merge_requests=pp.merge_requests,
            )
            for pp in project_performances
        ],
    )


def summarize_project_performance(
    *,
    gitlab_client: gitlab.Gitlab,
    project_id: int,
    start_date: datetime,
    end_date: datetime,
) -> GeneralProjectPerformance:
    """Build an aggregated view of a project's performance metrics."""

    project = gitlab_client.projects.get(project_id)

    # Fetch commits of project in the given time range for all users
    try:
        commits = project.commits.list(
            all=True,
            get_all=True,
            since=start_date.isoformat(),
            until=(
                end_date + timedelta(days=get_settings().safe_date_offset)
            ).isoformat(),
            with_stats=True,
        )
        project_commits = [
            commit
            for commit in commits
            if _parse_gitlab_datetime(commit.authored_date) >= start_date
            and _parse_gitlab_datetime(commit.authored_date) <= end_date
            and len(commit.parent_ids) < 2  # Exclude merge commits
        ]
    except GitlabError as exc:
        raise PerformanceComputationError(
            f"Failed to fetch commits for project ID {project_id}"
        ) from exc

    total_additions = 0
    total_deletions = 0
    daily_commit_counts: dict[datetime, int] = defaultdict(int)
    daily_additions: dict[datetime, int] = defaultdict(int)
    daily_deletions: dict[datetime, int] = defaultdict(int)
    daily_changes: dict[datetime, int] = defaultdict(int)

    contributors: dict[str, ProjectContributorStats] = {}

    for commit in project_commits:
        stats = commit.stats or {}
        num_additions = stats.get("additions", 0)
        num_deletions = stats.get("deletions", 0)

        total_additions += num_additions
        total_deletions += num_deletions

        authored_dt = _parse_gitlab_datetime(commit.authored_date)
        daily_commit_counts[authored_dt] += 1
        daily_additions[authored_dt] += num_additions
        daily_deletions[authored_dt] += num_deletions
        daily_changes[authored_dt] += num_additions + num_deletions

        author_email = commit.author_email
        if author_email not in contributors:
            contributors[author_email] = ProjectContributorStats(
                author_name=commit.author_name,
                author_email=author_email,
                commits=0,
                additions=0,
                deletions=0,
                changes=0,
            )
        contributor_stats = contributors[author_email]
        contributor_stats.commits += 1
        contributor_stats.additions += num_additions
        contributor_stats.deletions += num_deletions
        contributor_stats.changes += num_additions + num_deletions

    total_commits = len(project_commits)
    total_changes = total_additions + total_deletions

    return GeneralProjectPerformance(
        project_id=project.id,
        project_name=project.name,
        commits=total_commits,
        additions=total_additions,
        deletions=total_deletions,
        changes=total_changes,
        contributors=list(contributors.values()),
        daily_commit_counts=dict(daily_commit_counts),
        daily_additions=dict(daily_additions),
        daily_deletions=dict(daily_deletions),
        daily_changes=dict(daily_changes),
    )


def get_user_performance_for_llm(
    *,
    gitlab_client: gitlab.Gitlab,
    user_id: int,
    start_date: datetime,
    end_date: datetime,
    additional_user_emails: list[str] = [],
) -> str:
    """Return a summary of the user's performance for use with a language model in json format."""

    user = gitlab_client.users.get(user_id)
    user_emails = [user.email] + additional_user_emails

    # 1. Highlights: Approvals and Comments via Events
    events = _fetch_user_events(user=user, start=start_date, end=end_date)
    code_review_stats, event_project_ids = _summarize_events(events)

    # 2. Total Time Logs & Detail gathering
    token = gitlab_client.private_token or gitlab_client.oauth_token
    time_stats = get_time_spent_stats(
        gitlab_token=token,
        gitlab_base_url=gitlab_client.url,
        username=user.username,
        start_time=start_date,
        end_time=end_date,
        first=100,
    )

    # Prepare data structures
    highlights = {
        "total_commits": 0,
        "add_lines": 0,
        "remove_lines": 0,
        "approvals": code_review_stats.approvals_given,
        "comments": code_review_stats.review_comments + code_review_stats.notes_authored,
        "total_time_spent": f"{time_stats.total_time_spent_hours:.2f} hours",
    }

    # Map: key="project_id:iid", value={details, commits:[], time_logs:[]}
    mr_cache: dict[str, dict[str, Any]] = {}
    issue_logs: list[dict[str, Any]] = []
    main_branch_commits: list[dict[str, Any]] = []

    # Cache for full objects to avoid repeated API calls
    project_obj_cache: dict[int, Any] = {}

    # Process Time Logs
    all_timelogs = []
    for proj_log in time_stats.project_timelogs:
        all_timelogs.extend(proj_log.timelogs)

    for log in all_timelogs:
        formatted_time = (
            f"{int(log.time_spent / 60)}m"
            if log.time_spent < 3600
            else f"{log.time_spent / 3600:.1f}h"
        )
        
        # CHANGED: Force date string format
        date_str = log.spent_at.strftime("%Y-%m-%d")

        log_entry = {
            "time": formatted_time,
            "summary": log.summary or "No summary",
            "date": date_str, 
        }

        if log.merge_request:
            key = f"{log.project.id}:{log.merge_request.iid}"
            if key not in mr_cache:
                mr_cache[key] = {
                    "title": log.merge_request.title,
                    "description": "", 
                    "project_id": log.project.id,
                    "iid": log.merge_request.iid,
                    "commits": [],
                    "time_logs": [],
                }
            mr_cache[key]["time_logs"].append(log_entry)

        elif log.issue:
            issue_desc = ""
            try:
                if log.project.id not in project_obj_cache:
                    project_obj_cache[log.project.id] = gitlab_client.projects.get(log.project.id)
                
                target_issue = project_obj_cache[log.project.id].issues.get(log.issue.iid)
                issue_desc = target_issue.description
            except Exception:
                issue_desc = "Could not fetch description"

            issue_logs.append(
                {
                    "issue_title": log.issue.title,
                    "issue_description": issue_desc,
                    "project": log.project.name_with_namespace,
                    "time_spent": formatted_time,
                    "summary": log.summary or "No summary",
                    "date": date_str,
                }
            )

    # 3. Process Commits and Link to MRs
    relevant_project_ids = event_project_ids.union(
        {pl.project.id for pl in time_stats.project_timelogs}
    )

    for pid in relevant_project_ids:
        try:
            if pid not in project_obj_cache:
                project_obj_cache[pid] = gitlab_client.projects.get(pid)

            project = project_obj_cache[pid]

            # Fetch commits
            commits = []
            for email in user_emails:
                commits.extend(
                    project.commits.list(
                        all=True,
                        get_all=True,
                        since=start_date.isoformat(),
                        until=(end_date + timedelta(days=1)).isoformat(),
                        author=email,
                        with_stats=True,
                    )
                )

            # Filter valid commits
            valid_commits = []
            for c in commits:
                if c.author_email in user_emails and len(c.parent_ids) < 2:
                    # Parse date once to use for comparison and display
                    c_date_obj = _parse_gitlab_datetime(c.authored_date)
                    if start_date <= c_date_obj <= end_date:
                        valid_commits.append((c, c_date_obj))

            for commit, commit_date_obj in valid_commits:
                stats = commit.stats or {}
                adds = stats.get("additions", 0)
                rems = stats.get("deletions", 0)

                highlights["total_commits"] += 1
                highlights["add_lines"] += adds
                highlights["remove_lines"] += rems

                commit_info = {
                    "message": commit.title,
                    "add_lines": adds,
                    "remove_lines": rems,
                    # CHANGED: Use the parsed date object formatted as YYYY-MM-DD
                    "date": commit_date_obj.strftime("%Y-%m-%d"),
                }

                try:
                    associated_mrs = commit.merge_requests()
                except Exception:
                    associated_mrs = []

                if not associated_mrs:
                    commit_info["project"] = project.name_with_namespace
                    main_branch_commits.append(commit_info)
                else:
                    for mr_ref in associated_mrs:
                        mr_iid = mr_ref.get("iid")
                        mr_key = f"{pid}:{mr_iid}"

                        if mr_key not in mr_cache:
                            description = mr_ref.get("description", "")
                            if not description:
                                try:
                                    full_mr = project.mergerequests.get(mr_iid)
                                    description = full_mr.description
                                except:
                                    description = ""

                            mr_cache[mr_key] = {
                                "title": mr_ref.get("title"),
                                "description": description,
                                "project_id": pid,
                                "iid": mr_iid,
                                "commits": [],
                                "time_logs": [],
                            }

                        mr_cache[mr_key]["commits"].append(commit_info)

        except Exception:
            continue

    formatted_merge_requests = list(mr_cache.values())

    # Construct final JSON object
    final_data = {
        # CHANGED: Format start/end date as simple date strings
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "username": user.username,
        "highlights": highlights,
        "total_time_logs": highlights["total_time_spent"],
        "merge_requests": formatted_merge_requests,
        "main_branch_commits": main_branch_commits,
        "issue_time_logs": issue_logs,
    }

    return json.dumps(final_data, indent=2, default=str)

"""Aggregate GitLab commit/review data into developer performance metrics."""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from typing import Iterable
import requests

import gitlab
from gitlab.exceptions import GitlabError

from app.core.config import get_settings
from app.schemas.performance import (
    UserInfo,
    ProjectInfo,
    Commit,
    MergeRequestDetails,
    ProjectPerformanceResponse,
    TimelogNode,
    TimeSpentStats,
    CodeReviewStats,
    GeneralUserPerformance,
)

_UTC = dt.timezone.utc


class PerformanceComputationError(RuntimeError):
    """Raised when GitLab data cannot be aggregated."""


def _parse_gitlab_datetime(value: str) -> dt.datetime:
    """Convert GitLab ISO datetime strings into aware UTC datetimes."""
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    parsed = dt.datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=_UTC)
    return parsed.astimezone(_UTC)


def _fetch_user_events(
    *,
    user: gitlab.v4.objects.User,
    start: dt.datetime,
    end: dt.datetime,
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
    user_email: str,
    project_id: int,
    since: dt.datetime,
    until: dt.datetime,
) -> ProjectPerformanceResponse:
    """Collect performance stats for a specific project."""
    # Fetch project
    try:
        project = gitlab_client.projects.get(project_id)
    except GitlabError as exc:
        raise PerformanceComputationError(
            f"Failed to load project with ID {project_id}"
        ) from exc

    # Fetch commits by the user
    try:
        commits = project.commits.list(
            all=True,
            since=since.isoformat(),
            until=until.isoformat(),
            author=user_email,
            with_stats=True,
        )
        user_commits = [
            commit
            for commit in commits
            if commit.author_email == user_email
            and _parse_gitlab_datetime(commit.authored_date) >= since
            and _parse_gitlab_datetime(commit.authored_date) <= until
        ]
    except GitlabError as exc:
        raise PerformanceComputationError(
            f"Failed to fetch commits for project ID {project_id}"
        ) from exc

    # Fetching merge requests related to each commit and compute stats
    sorted_commits = sorted(
        user_commits,
        key=lambda c: _parse_gitlab_datetime(c.authored_date),
    )
    merge_requests: dict[
        int : (dict, list[int])
    ] = {}  # mr_iid -> (mr_details, [commit_ids])
    total_additions = 0
    total_deletions = 0
    daily_commit_counts: dict[str, int] = defaultdict(int)
    daily_additions: dict[str, int] = defaultdict(int)
    daily_deletions: dict[str, int] = defaultdict(int)
    daily_changes: dict[str, int] = defaultdict(int)

    for commit in sorted_commits:
        num_additions = commit.stats.get("additions", 0)
        num_deletions = commit.stats.get("deletions", 0)

        total_additions += num_additions
        total_deletions += num_deletions
        authored_date = _parse_gitlab_datetime(commit.authored_date)
        date_str = authored_date.date().isoformat()
        daily_commit_counts[date_str] += 1
        daily_additions[date_str] += num_additions
        daily_deletions[date_str] += num_deletions
        daily_changes[date_str] += num_additions + num_deletions

        try:
            mrs = commit.merge_requests()
            for mr in mrs:
                mr_iid = mr["iid"]
                if mr_iid not in merge_requests:
                    merge_requests[mr_iid] = (mr, [])
                merge_requests[mr_iid][1].append(commit.id)
        except GitlabError as exc:
            raise PerformanceComputationError(
                f"Failed to fetch merge requests for project ID {project_id}"
            ) from exc

    total_commits = len(user_commits)
    total_changes = total_additions + total_deletions

    merge_request_details = [MergeRequestDetails]
    for mr in merge_requests.values():
        mr_details, commit_ids = mr
        merge_request_details.append(
            MergeRequestDetails(
                iid=mr_details["iid"],
                title=mr_details["title"],
                description=mr_details["description"],
                web_url=mr_details["web_url"],
                state=mr_details["state"],
                created_at=_parse_gitlab_datetime(mr_details["created_at"]),
                commits_count=mr_details["commits_count"],
                commits=[
                    Commit(
                        title=commit.title,
                        message=commit.message,
                        web_url=commit.web_url,
                        authored_date=_parse_gitlab_datetime(commit.authored_date),
                        additions=commit.stats["additions"],
                        deletions=commit.stats["deletions"],
                    )
                    for commit in user_commits
                    if commit.id in commit_ids
                ],
            )
        )

    return ProjectPerformanceResponse(
        user_email=user_email,
        project_path_name=project.path_with_namespace,
        since=since,
        until=until,
        total_commits=total_commits,
        total_additions=total_additions,
        total_deletions=total_deletions,
        total_changes=total_changes,
        total_mr_contributed=len(merge_requests),
        daily_commit_counts=dict(daily_commit_counts),
        daily_additions=dict(daily_additions),
        daily_deletions=dict(daily_deletions),
        daily_changes=dict(daily_changes),
        calculated_at=dt.datetime.now(_UTC),
        merge_requests=merge_request_details,
    )


def get_time_spent_stats(
    gitlab_token: str,
    gitlab_base_url: str,
    username: str,
    start_time: dt.datetime,
    end_time: dt.datetime,
    first: int = 100,
    after: int = 1,
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
        "username": username,
        "startTime": start_time.isoformat(),
        "endTime": end_time.isoformat(),
        "first": first,
        "after": after,
    }

    headers = {
        "Authorization": f"Bearer {gitlab_token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            graph_ql_url, json={"query": query, "variables": variables}, headers=headers
        )
    except requests.RequestException as exc:
        raise PerformanceComputationError("Failed to fetch time spent data") from exc

    if response.status_code != 200:
        raise PerformanceComputationError(
            f"GraphQL query failed with status code {response.status_code}"
        )

    timelog_nodes: list[TimelogNode] = []
    time_spent_per_day: dict[str, float] = defaultdict(float)
    for node in response.json().get("data", {}).get("timelogs", {}).get("nodes", []):
        timelog_nodes.append(
            TimelogNode(
                id=node["id"],
                project=node["project"],
                time_spent=node["timeSpent"],
                spent_at=node["spentAt"],
                summary=node.get("summary"),
                issue_iid=node.get("issue", {}).get("iid"),
                issue_title=node.get("issue", {}).get("title"),
                mr_iid=node.get("mergeRequest", {}).get("iid"),
                mr_title=node.get("mergeRequest", {}).get("title"),
            )
        )
        spent_date = _parse_gitlab_datetime(node["spentAt"]).date().isoformat()
        time_spent_per_day[spent_date] += node["timeSpent"] / 3600.0  # convert to hours

    return TimeSpentStats(
        username=username,
        timelog_entries=timelog_nodes,
        total_time_logged_hours=float(
            response.json().get("data", {}).get("timelogs", {}).get("totalSpentTime", 0)
        )
        / 3600.0,
        time_spent_per_day=time_spent_per_day,
    )


def summarize_user_performance(
    *,
    gitlab_client: gitlab.Gitlab,
    user_id: int,
    start_date: dt.datetime,
    end_date: dt.datetime,
) -> GeneralUserPerformance:
    """Build an aggregated view of a developer's performance across projects."""
    user = gitlab_client.users.get(user_id)
    user_email = user.email
    user_info = UserInfo(
        id=user.id,
        name=user.name,
        username=user.username,
        avatarUrl=user.avatar_url,
        webPath=user.web_url,
    )

    # Fetch and summarize events
    events = _fetch_user_events(user=user, start=start_date, end=end_date)
    code_review_stats, involved_project_ids = _summarize_events(events)

    # Gather project-specific performance data
    project_performances: list[ProjectPerformanceResponse] = []
    total_commits = 0
    total_additions = 0
    total_deletions = 0
    daily_commit_counts: dict[str, int] = defaultdict(
        int
    )  # date string to commit count mapping
    daily_additions: dict[str, int] = defaultdict(
        int
    )  # date string to additions count mapping
    daily_deletions: dict[str, int] = defaultdict(
        int
    )  # date string to deletions count mapping
    daily_changes: dict[str, int] = defaultdict(
        int
    )  # date string to changes count mapping
    for project_id in involved_project_ids:
        project_stats = get_project_performance_stats(
            gitlab_client=gitlab_client,
            user_email=user_email,
            project_id=project_id,
            since=start_date,
            until=end_date,
        )
        project_performances.append(project_stats)

        total_commits += project_stats.total_commits
        total_additions += project_stats.total_additions
        total_deletions += project_stats.total_deletions

        for date_str, count in project_stats.daily_commit_counts.items():
            daily_commit_counts[date_str] += count
        for date_str, adds in project_stats.daily_additions.items():
            daily_additions[date_str] += adds
        for date_str, dels in project_stats.daily_deletions.items():
            daily_deletions[date_str] += dels
        for date_str, changes in project_stats.daily_changes.items():
            daily_changes[date_str] += changes

    return GeneralUserPerformance(
        user_info=user_info,
        start_date=start_date,
        end_date=end_date,
        total_commits=total_commits,
        total_additions=total_additions,
        total_deletions=total_deletions,
        total_changes=total_additions + total_deletions,
        code_review_stats=code_review_stats,
        project_performances=project_performances,
        daily_commit_counts=dict(daily_commit_counts),
        daily_additions=dict(daily_additions),
        daily_deletions=dict(daily_deletions),
        daily_changes=dict(daily_changes),
        calculated_at=dt.datetime.now(_UTC),
    )

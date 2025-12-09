"""Background scheduler that emails weekly performance reports."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
import jdatetime
from functools import lru_cache
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from bson import ObjectId
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema
from jinja2 import BaseLoader, Environment, select_autoescape

from app.core.config import get_settings
from app.db.database import get_database
from app.services.gitlab import GitLabTokenError, validate_gitlab_admin_token
from app.services.performance import (
    PerformanceComputationError,
    get_time_spent_stats,
    summarize_user_performance,
)

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler(timezone=timezone.utc)


def _to_jalali(dt: datetime) -> jdatetime.datetime:
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return jdatetime.datetime.fromgregorian(datetime=dt)


def _format_jalali_date(dt: datetime) -> str:
    """Return a Jalali date string for display."""

    return _to_jalali(dt).strftime("%Y-%m-%d")


def _format_jalali_datetime(dt: datetime) -> str:
    """Return a Jalali date-time string for display."""

    return _to_jalali(dt).strftime("%Y-%m-%d %H:%M")


_EMAIL_TEMPLATE = Environment(
    loader=BaseLoader(),
    autoescape=select_autoescape(enabled_extensions=("html",)),
).from_string(
    """
    <div style="font-family: Arial, sans-serif; line-height: 1.4; color: #1f2933;">
      <h2 style="margin-bottom: 4px;">Weekly performance for {{ perf.username }}</h2>
      <p style="margin-top: 0; color: #52606d;">
        Period: {{ jalali_date(start_date) }} – {{ jalali_date(end_date) }}
      </p>

      <h3 style="margin-bottom: 4px;">Highlights</h3>
      <ul style="margin-top: 4px;">
        <li><strong>Commits:</strong> {{ perf.commits }}</li>
        <li><strong>Changes:</strong> {{ perf.changes }} ( +{{ perf.additions }}, -{{ perf.deletions }} )</li>
        <li><strong>MRs touched:</strong> {{ perf.mr_contributed }}</li>
        <li><strong>Approvals:</strong> {{ perf.approvals_given }}</li>
        <li><strong>Review comments:</strong> {{ perf.review_comments }}</li>
      </ul>

      {% if time_spent %}
      <h3 style="margin-bottom: 4px;">Time spent</h3>
      <ul style="margin-top: 4px;">
        <li><strong>Total hours:</strong> {{ "%.1f" | format(time_spent.total_time_spent_hours) }}</li>
        <li><strong>MRs contributed:</strong> {{ time_spent.mr_contributed }}</li>
        <li><strong>Issues contributed:</strong> {{ time_spent.issue_contributed }}</li>
      </ul>
      {% if time_spent.daily_project_time_spent %}
      <table style="border-collapse: collapse; width: 100%; margin-top: 6px;">
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">Date</th>
            <th style="text-align: left; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">Project</th>
            <th style="text-align: right; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">Hours</th>
          </tr>
        </thead>
        <tbody>
        {% for date, project, hours in time_spent.daily_project_time_spent %}
          <tr>
            <td style="padding: 6px 4px; border-bottom: 1px solid #e5e9f2;">{{ jalali_date(date) }}</td>
            <td style="padding: 6px 4px; border-bottom: 1px solid #e5e9f2;">{{ project }}</td>
            <td style="padding: 6px 4px; text-align: right; border-bottom: 1px solid #e5e9f2;">{{ "%.1f"|format(hours) }}</td>
          </tr>
        {% endfor %}
        </tbody>
      </table>
      {% endif %}
      {% endif %}

      {% if perf.daily_commit_counts %}
      <h3 style="margin-bottom: 4px;">Daily activity</h3>
      <table style="border-collapse: collapse; width: 100%; margin-top: 6px;">
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">Date</th>
            <th style="text-align: right; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">Commits</th>
            <th style="text-align: right; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">Changes</th>
          </tr>
        </thead>
        <tbody>
        {% for date, commits in perf.daily_commit_counts|dictsort %}
          <tr>
            <td style="padding: 6px 4px; border-bottom: 1px solid #e5e9f2;">{{ jalali_date(date) }}</td>
            <td style="padding: 6px 4px; text-align: right; border-bottom: 1px solid #e5e9f2;">{{ commits }}</td>
            <td style="padding: 6px 4px; text-align: right; border-bottom: 1px solid #e5e9f2;">
              {{ perf.daily_changes.get(date, 0) }}
            </td>
          </tr>
        {% endfor %}
        </tbody>
      </table>
      {% endif %}

      {% if perf.project_performances %}
      <h3 style="margin-bottom: 4px;">By project</h3>
      <table style="border-collapse: collapse; width: 100%; margin-top: 6px;">
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">Project</th>
            <th style="text-align: right; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">Commits</th>
            <th style="text-align: right; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">Changes</th>
            <th style="text-align: right; border-bottom: 1px solid #d3dce6; padding: 6px 4px;">MRs</th>
          </tr>
        </thead>
        <tbody>
        {% for proj in perf.project_performances %}
          <tr>
            <td style="padding: 6px 4px; border-bottom: 1px solid #e5e9f2;">
              <a href="{{ proj.web_url }}" style="color: #1f7aec; text-decoration: none;">
                {{ proj.name_with_namespace or proj.name }}
              </a>
            </td>
            <td style="padding: 6px 4px; text-align: right; border-bottom: 1px solid #e5e9f2;">{{ proj.commits }}</td>
            <td style="padding: 6px 4px; text-align: right; border-bottom: 1px solid #e5e9f2;">{{ proj.changes }}</td>
            <td style="padding: 6px 4px; text-align: right; border-bottom: 1px solid #e5e9f2;">{{ proj.mr_contributed }}</td>
          </tr>
        {% endfor %}
        </tbody>
      </table>
      {% endif %}

      <p style="margin-top: 12px; color: #52606d;">
        Generated at {{ jalali_datetime(now_utc) }} (Jalali).
      </p>
    </div>
    """
)


def _job_id(schedule_id: ObjectId | str) -> str:
    return f"user-performance-report-{schedule_id}"


def _normalize_object_id(value: str | ObjectId) -> ObjectId:
    if isinstance(value, ObjectId):
        return value
    return ObjectId(str(value))


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


@lru_cache(maxsize=1)
def _get_mail_client() -> FastMail:
    """Build and cache the FastMail client."""

    settings = get_settings()
    missing_fields = [
        name
        for name, configured in {
            "mail_server": settings.mail_server,
            "mail_port": settings.mail_port,
            "mail_from": settings.mail_from,
        }.items()
        if not configured
    ]
    if missing_fields:
        raise RuntimeError(
            f"Email settings are incomplete: {', '.join(sorted(missing_fields))}"
        )

    mail_conf = ConnectionConfig(
        MAIL_USERNAME=settings.mail_username,
        MAIL_PASSWORD=settings.mail_password,
        MAIL_FROM=settings.mail_from,
        MAIL_FROM_NAME=settings.mail_from_name,
        MAIL_SERVER=settings.mail_server,
        MAIL_PORT=settings.mail_port,
        MAIL_STARTTLS=settings.mail_starttls,
        MAIL_SSL_TLS=settings.mail_ssl_tls,
        USE_CREDENTIALS=bool(settings.mail_username)
        if settings.use_credentials is None
        else settings.use_credentials,
        VALIDATE_CERTS=True,
    )
    return FastMail(mail_conf)


def _get_gitlab_client():
    mongo_db = get_database()
    app_config = mongo_db["app_user_config"].find_one({})
    if not app_config:
        logger.warning("GitLab admin token is not configured; skipping scheduled email")
        return None

    gitlab_url = app_config.get("gitlab_url")
    gitlab_token = app_config.get("gitlab_admin_token")
    if not gitlab_url or not gitlab_token:
        logger.warning("GitLab admin token is missing; skipping scheduled email")
        return None

    try:
        gitlab_user_info, gitlab_client = validate_gitlab_admin_token(
            gitlab_url=gitlab_url,
            admin_token=gitlab_token,
        )
        app_config["gitlab_user_info"] = gitlab_user_info
        return app_config, gitlab_client
    except GitLabTokenError as exc:
        logger.error("GitLab admin token validation failed: %s", exc)
        return None


def _get_additional_user_emails(user_id: int) -> list[str]:
    mongo_db = get_database()
    settings_doc = mongo_db["user_performance_settings"].find_one({"user_id": user_id})
    return settings_doc.get("additional_user_emails", []) if settings_doc else []


def _record_last_error(schedule_id: ObjectId, error: str) -> None:
    mongo_db = get_database()
    mongo_db["scheduled_reports"].update_one(
        {"_id": schedule_id}, {"$set": {"last_error": error, "updated_at": _now_utc()}}
    )


def _render_email_body(
    perf: Any, time_spent: Any | None, start_date: datetime, end_date: datetime
) -> str:
    return _EMAIL_TEMPLATE.render(
        perf=perf,
        time_spent=time_spent,
        start_date=start_date,
        end_date=end_date,
        now_utc=_now_utc(),
        jalali_date=_format_jalali_date,
        jalali_datetime=_format_jalali_datetime,
    )


async def send_scheduled_report(schedule_id: str) -> None:
    """Load a schedule from MongoDB and send the email report."""

    try:
        schedule_object_id = _normalize_object_id(schedule_id)
    except Exception:
        logger.error("Invalid schedule id %s; skipping job", schedule_id)
        return

    mongo_db = get_database()
    schedule = mongo_db["scheduled_reports"].find_one({"_id": schedule_object_id})
    if not schedule:
        logger.warning("Schedule %s not found; removing job", schedule_id)
        remove_schedule_job(schedule_id)
        return

    if not schedule.get("active", True):
        remove_schedule_job(schedule_id)
        return

    recipients = schedule.get("to", [])
    if not recipients:
        logger.warning("Schedule %s has no recipients; skipping", schedule_id)
        return

    gitlab_info = _get_gitlab_client()
    if gitlab_info is None:
        _record_last_error(schedule_object_id, "GitLab admin token is not configured")
        return

    app_config, gitlab_client = gitlab_info
    start_date = _now_utc() - timedelta(days=7)
    end_date = _now_utc()
    time_spent = None

    try:
        performance = summarize_user_performance(
            gitlab_client=gitlab_client,
            user_id=int(schedule["user_id"]),
            start_date=start_date,
            end_date=end_date,
            additional_user_emails=_get_additional_user_emails(
                int(schedule["user_id"])
            ),
        )
    except PerformanceComputationError as exc:
        logger.error(
            "Failed to compute performance for schedule %s: %s", schedule_id, exc
        )
        _record_last_error(schedule_object_id, str(exc))
        return
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Unexpected error computing performance for %s", schedule_id)
        _record_last_error(schedule_object_id, str(exc))
        return

    try:
        user = gitlab_client.users.get(int(schedule["user_id"]))
        time_spent = get_time_spent_stats(
            gitlab_base_url=app_config["gitlab_url"],
            gitlab_token=app_config["gitlab_admin_token"],
            username=user.username,
            start_time=start_date,
            end_time=end_date,
        )
    except Exception as exc:  # pragma: no cover - external API failure
        logger.error(
            "Failed to compute time spent for schedule %s: %s", schedule_id, exc
        )
        time_spent = None

    try:
        mail_client = _get_mail_client()
    except RuntimeError as exc:
        logger.error("Email configuration error: %s", exc)
        _record_last_error(schedule_object_id, str(exc))
        return

    subject = (
        schedule.get("subject", f"Weekly performance report for {performance.username}")
        or f"Weekly performance report for {performance.username}"
    )
    body = _render_email_body(performance, time_spent, start_date, end_date)
    message = MessageSchema(
        subject=subject,
        recipients=recipients,
        cc=schedule.get("cc") or [],
        bcc=schedule.get("bcc") or [],
        body=body,
        subtype="html",
    )

    try:
        # write in database for now for debugging purposes
        logger.info("Sending email for schedule %s to %s", schedule_id, recipients)
        await mail_client.send_message(message)
        mongo_db["scheduled_reports"].update_one(
            {"_id": schedule_object_id},
            {
                "$set": {
                    "last_sent_at": _now_utc(),
                    "last_error": None,
                    "updated_at": _now_utc(),
                    "last_email_content": body,
                }
            },
        )
        logger.info("Sent weekly performance report for schedule %s", schedule_id)
    except Exception as exc:  # pragma: no cover - external service failure
        logger.error("Failed to send email for schedule %s: %s", schedule_id, exc)
        _record_last_error(schedule_object_id, str(exc))


def _register_job(schedule: dict[str, Any]) -> None:
    """Create or refresh an APScheduler job from a schedule document."""

    schedule_id = str(schedule["_id"])
    if not schedule.get("active", True):
        return

    trigger = CronTrigger(
        day_of_week=schedule.get("day_of_week", "mon"),
        hour=int(schedule.get("hour_utc", 7)),
        minute=int(schedule.get("minute_utc", 0)),
        timezone=timezone.utc,
    )

    _scheduler.add_job(
        send_scheduled_report,
        trigger=trigger,
        id=_job_id(schedule_id),
        kwargs={"schedule_id": schedule_id},
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600,
    )


def sync_scheduled_jobs() -> None:
    """Read schedules from MongoDB and ensure matching jobs exist."""

    mongo_db = get_database()
    active_ids: set[str] = set()
    manual_triggers: list[tuple[str, ObjectId]] = []

    for schedule in mongo_db["scheduled_reports"].find({}):
        schedule_id = str(schedule["_id"])
        is_active = schedule.get("active", True)
        if schedule.get("manual_trigger_at") and is_active:
            manual_triggers.append((schedule_id, schedule["_id"]))

        if is_active:
            active_ids.add(schedule_id)
            _register_job(schedule)

    # Remove jobs for deleted/inactive schedules
    for job in _scheduler.get_jobs():
        if not job.id.startswith("user-performance-report-"):
            continue
        sid = job.id.replace("user-performance-report-", "").replace("-manual", "")
        if sid not in active_ids:
            job.remove()

    # Queue manual triggers
    for schedule_id, object_id in manual_triggers:
        _scheduler.add_job(
            send_scheduled_report,
            trigger="date",
            run_date=_now_utc(),
            id=f"{_job_id(schedule_id)}-manual",
            kwargs={"schedule_id": schedule_id},
            replace_existing=True,
            max_instances=1,
        )
        mongo_db["scheduled_reports"].update_one(
            {"_id": object_id},
            {"$set": {"manual_trigger_at": None, "updated_at": _now_utc()}},
        )


def remove_schedule_job(schedule_id: str) -> None:
    """Remove all jobs from the scheduler for a schedule id."""

    base_id = _job_id(schedule_id)
    for job in _scheduler.get_jobs():
        if job.id.startswith(base_id):
            job.remove()


def upsert_schedule_job(schedule: dict[str, Any]) -> None:
    """Refresh a schedule job after a create/update operation."""

    _register_job(schedule)


def start_scheduler() -> None:
    """Start the scheduler if it is not already running."""

    if not _scheduler.running:
        _scheduler.start()


def shutdown_scheduler() -> None:
    """Stop the scheduler when the application shuts down."""

    if _scheduler.running:
        _scheduler.shutdown(wait=False)


def schedule_sync_job(interval_seconds: int = 60) -> None:
    """Periodically reload schedules from MongoDB."""

    _scheduler.add_job(
        sync_scheduled_jobs,
        trigger="interval",
        seconds=interval_seconds,
        id="scheduled-reports-sync",
        replace_existing=True,
        max_instances=1,
    )


def next_run_time(schedule: dict[str, Any]) -> datetime | None:
    """Return the next planned run time for a schedule."""

    if not schedule.get("active", True):
        return None
    trigger = CronTrigger(
        day_of_week=schedule.get("day_of_week", "mon"),
        hour=int(schedule.get("hour_utc", 7)),
        minute=int(schedule.get("minute_utc", 0)),
        timezone=timezone.utc,
    )
    return trigger.get_next_fire_time(None, _now_utc())


def run_schedule_now(schedule_id: str) -> None:
    """Mark a schedule for immediate execution by the scheduler process."""

    mongo_db = get_database()
    try:
        oid = _normalize_object_id(schedule_id)
    except Exception:
        return
    mongo_db["scheduled_reports"].update_one(
        {"_id": oid},
        {"$set": {"manual_trigger_at": _now_utc(), "updated_at": _now_utc()}},
    )

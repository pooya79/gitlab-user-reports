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
    get_user_performance_for_llm,
)
from app.agents import PerformancePrompt, PerformanceAgent

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
    <!DOCTYPE html>
    <html>
    <head>
    <style>
        /* Client-specific resets */
        body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
    </style>
    </head>
    <body style="background-color: #f4f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px 0;">
        
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e1e4e8;">
            
            <!-- HEADER -->
            <div style="background-color: #24292e; padding: 24px 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Weekly Performance</h1>
                <p style="color: #a3aab1; margin: 8px 0 0 0; font-size: 14px;">
                    {{ perf.username }}
                </p>
                <div style="display: inline-block; background: rgba(255,255,255,0.1); border-radius: 4px; padding: 4px 12px; margin-top: 12px;">
                    <span style="color: #ffffff; font-size: 12px; letter-spacing: 0.5px;">
                        {{ jalali_date(start_date) }} — {{ jalali_date(end_date) }}
                    </span>
                </div>
            </div>

            <!-- CONTENT -->
            <div style="padding: 30px;">

                <!-- KEY METRICS GRID -->
                <h3 style="margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #8899a6; border-bottom: 2px solid #f1f3f5; padding-bottom: 8px;">
                    Highlights
                </h3>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                    <tr>
                        <td width="33%" style="text-align: center; padding: 10px; border-right: 1px solid #eee;">
                            <div style="font-size: 24px; font-weight: 700; color: #2c3e50;">{{ perf.commits }}</div>
                            <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; margin-top: 4px;">Commits</div>
                        </td>
                        <td width="33%" style="text-align: center; padding: 10px; border-right: 1px solid #eee;">
                            <div style="font-size: 24px; font-weight: 700; color: #2c3e50;">{{ perf.mr_contributed }}</div>
                            <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; margin-top: 4px;">MRs Touched</div>
                        </td>
                        <td width="33%" style="text-align: center; padding: 10px;">
                            <div style="font-size: 24px; font-weight: 700; color: #2c3e50;">{{ perf.approvals_given }}</div>
                            <div style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; margin-top: 4px;">Approvals</div>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="border-top: 1px solid #eee; padding-top: 15px; text-align: center;">
                            <span style="font-size: 14px; color: #52606d;">Lines of Code: </span>
                            <span style="color: #28a745; font-weight: 600; margin-left: 5px;">+{{ perf.additions }}</span>
                            <span style="color: #cb2431; font-weight: 600; margin-left: 5px;">-{{ perf.deletions }}</span>
                            <span style="color: #52606d; font-size: 13px; margin-left: 15px;">({{ perf.review_comments }} comments)</span>
                        </td>
                    </tr>
                </table>

                <!-- TIME SPENT (Conditional) -->
                {% if time_spent %}
                <h3 style="margin: 25px 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #8899a6; border-bottom: 2px solid #f1f3f5; padding-bottom: 8px;">
                    Time Management
                </h3>
                <div style="background-color: #f8f9fa; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
                    <table width="100%">
                        <tr>
                            <td style="color: #52606d;"><strong>Total Hours:</strong></td>
                            <td style="text-align: right; color: #24292e;">{{ "%.1f" | format(time_spent.total_time_spent_hours) }} hrs</td>
                        </tr>
                        <tr>
                            <td style="color: #52606d;"><strong>MRs Contributed:</strong></td>
                            <td style="text-align: right; color: #24292e;">{{ time_spent.mr_contributed }}</td>
                        </tr>
                        <tr>
                            <td style="color: #52606d;"><strong>Issues Contributed:</strong></td>
                            <td style="text-align: right; color: #24292e;">{{ time_spent.issue_contributed }}</td>
                        </tr>
                    </table>
                </div>

                {% if time_spent.daily_project_time_spent %}
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background-color: #f1f3f5;">
                            <th style="text-align: left; padding: 8px; border-radius: 4px 0 0 4px; color: #495057;">Date</th>
                            <th style="text-align: left; padding: 8px; color: #495057;">Project</th>
                            <th style="text-align: right; padding: 8px; border-radius: 0 4px 4px 0; color: #495057;">Hours</th>
                        </tr>
                    </thead>
                    <tbody>
                    {% for date, project, hours in time_spent.daily_project_time_spent %}
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #495057;">{{ jalali_date(date) }}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef; font-weight: 500; color: #24292e;">{{ project }}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef; text-align: right; color: #24292e;">{{ "%.1f"|format(hours) }}</td>
                        </tr>
                    {% endfor %}
                    </tbody>
                </table>
                {% endif %}
                {% endif %}

                <!-- DAILY ACTIVITY -->
                {% if perf.daily_commit_counts %}
                <h3 style="margin: 30px 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #8899a6; border-bottom: 2px solid #f1f3f5; padding-bottom: 8px;">
                    Daily Activity
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background-color: #f1f3f5;">
                            <th style="text-align: left; padding: 8px; border-radius: 4px 0 0 4px; color: #495057;">Date</th>
                            <th style="text-align: right; padding: 8px; color: #495057;">Commits</th>
                            <th style="text-align: right; padding: 8px; border-radius: 0 4px 4px 0; color: #495057;">Changes</th>
                        </tr>
                    </thead>
                    <tbody>
                    {% for date, commits in perf.daily_commit_counts|dictsort %}
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef; color: #495057;">{{ jalali_date(date) }}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef; text-align: right;">
                                <span style="background: #e1e4e8; padding: 2px 6px; border-radius: 10px; font-size: 11px;">{{ commits }}</span>
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef; text-align: right; color: #24292e;">
                                {{ perf.daily_changes.get(date, 0) }}
                            </td>
                        </tr>
                    {% endfor %}
                    </tbody>
                </table>
                {% endif %}

                <!-- BY PROJECT -->
                {% if perf.project_performances %}
                <h3 style="margin: 30px 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #8899a6; border-bottom: 2px solid #f1f3f5; padding-bottom: 8px;">
                    Project Breakdown
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background-color: #f1f3f5;">
                            <th style="text-align: left; padding: 8px; border-radius: 4px 0 0 4px; color: #495057;">Project</th>
                            <th style="text-align: right; padding: 8px; color: #495057;">Com.</th>
                            <th style="text-align: right; padding: 8px; color: #495057;">Chg.</th>
                            <th style="text-align: right; padding: 8px; border-radius: 0 4px 4px 0; color: #495057;">MRs</th>
                        </tr>
                    </thead>
                    <tbody>
                    {% for proj in perf.project_performances %}
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">
                                <a href="{{ proj.web_url }}" style="color: #0366d6; text-decoration: none; font-weight: 500;">
                                    {{ proj.name_with_namespace or proj.name }}
                                </a>
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef; text-align: right; color: #586069;">{{ proj.commits }}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef; text-align: right; color: #586069;">{{ proj.changes }}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e9ecef; text-align: right; color: #586069;">{{ proj.mr_contributed }}</td>
                        </tr>
                    {% endfor %}
                    </tbody>
                </table>
                {% endif %}

            </div>

            <!-- FOOTER -->
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-top: 1px solid #e1e4e8;">
                <p style="margin: 0; color: #959da5; font-size: 11px;">
                    Generated at {{ jalali_datetime(now_utc) }} (Jalali)
                </p>
            </div>
            
        </div>
    </body>
    </html>
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
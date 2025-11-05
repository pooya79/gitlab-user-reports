from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.jobstores.mongodb import MongoDBJobStore

from app.services import NOW_UTC
from app.db.database import get_client
from app.core.config import get_settings

jobstores = {
    "default": MongoDBJobStore(
        database=get_settings().mongodb_database,
        collection="apscheduler_jobs",
        client=get_client(),
    )
}


def daily_job():
    print("Running scheduled job at", NOW_UTC())


if __name__ == "__main__":
    scheduler = BlockingScheduler(jobstores=jobstores, timezone="UTC")
    scheduler.add_job(daily_job, "cron", hour=0, minute=0)
    scheduler.start()

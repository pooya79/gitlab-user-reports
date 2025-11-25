"""Run the APScheduler worker outside of the FastAPI process."""

from __future__ import annotations

import asyncio
import logging

from app.db.database import close_client, init_db
from app.services.scheduler import (
    schedule_sync_job,
    start_scheduler,
    sync_scheduled_jobs,
)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    init_db()

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    async def _startup() -> None:
        start_scheduler()
        sync_scheduled_jobs()
        schedule_sync_job()

    loop.create_task(_startup())
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        pass
    finally:
        close_client()


if __name__ == "__main__":
    main()

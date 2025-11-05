"""Development entrypoint for running the FastAPI application."""

import uvicorn
import dotenv

dotenv.load_dotenv()

from app.core.config import get_settings # noqa: E402


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    main()

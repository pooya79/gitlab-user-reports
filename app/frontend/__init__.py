"""Frontend utilities such as templates and static file helpers."""

from pathlib import Path

from fastapi.templating import Jinja2Templates

PACKAGE_DIR = Path(__file__).parent
TEMPLATE_DIR = PACKAGE_DIR / "templates"
STATIC_DIR = PACKAGE_DIR / "static"

templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

__all__ = ["templates", "STATIC_DIR", "TEMPLATE_DIR", "PACKAGE_DIR"]

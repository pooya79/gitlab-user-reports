"""Service layer for encapsulating domain logic."""

import datetime as dt


def NOW_UTC() -> dt.datetime:
    """Get the current UTC datetime."""
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

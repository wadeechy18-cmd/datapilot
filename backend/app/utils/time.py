"""Shared time helper so "now" is defined consistently (timezone-aware UTC)
everywhere it's used -- DB defaults, JWT expiry, refresh-token expiry."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)

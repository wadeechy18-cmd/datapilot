"""Shared helper for normalizing openpyxl cell values to JSON-serializable types."""

import datetime
from decimal import Decimal
from typing import Any


def to_json_safe(value: Any) -> Any:
    """openpyxl can hand back types (datetime, Decimal, ...) that aren't
    directly JSON-serializable. Normalize those; leave the common types
    (str, int, float, bool, None) as-is."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return str(value)

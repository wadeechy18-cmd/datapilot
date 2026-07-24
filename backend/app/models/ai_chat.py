"""
Internal representation of an interpreted chat turn.

Kept separate from schemas/ for the same reason as the other models/
modules. `request` is a validated Pydantic request object for one of the
existing engines (FormattingRequest, CleaningRequest, ...) when kind isn't
"reply" -- typed loosely here since it can be any of six different schemas.
"""

from dataclasses import dataclass
from typing import Any


@dataclass
class ChatAction:
    kind: str  # "reply" | "format" | "clean" | "formula" | "chart" | "rows_columns" | "sort"
    message: str
    request: Any | None = None

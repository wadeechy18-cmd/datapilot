"""
Internal representation of a read workbook.

Kept separate from app/schemas/ so the API's public response shape can
change independently of how we represent a workbook internally. These are
plain dataclasses, not Pydantic models — nothing here crosses the HTTP
boundary directly.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SheetInfo:
    name: str
    row_count: int
    column_count: int
    headers: list[Any]
    preview_rows: list[list[Any]] = field(default_factory=list)
    non_empty_cells: int = 0
    empty_cells: int = 0
    numeric_cells: int = 0
    text_cells: int = 0


@dataclass
class WorkbookInfo:
    file_id: str
    sheet_names: list[str]
    sheets: list[SheetInfo]

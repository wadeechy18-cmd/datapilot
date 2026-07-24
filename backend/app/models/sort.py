"""
Internal representation of a workbook sort result.

Kept separate from schemas/ for the same reason as the other models/
modules -- the API response shape can evolve independently. `SheetData`
holds every sheet's raw (not JSON-safe) headers/rows, since a sort commit
rebuilds the whole workbook from scratch (openpyxl has no native row-sort)
-- only `WorkbookSortResult.sheet_name`'s rows are actually reordered, the
rest pass through unchanged so the rebuild is complete.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SheetData:
    name: str
    headers: list[Any]
    rows: list[list[Any]] = field(default_factory=list)


@dataclass
class WorkbookSortResult:
    file_id: str
    sheet_name: str
    column: str
    ascending: bool
    has_header: bool
    row_count: int
    sheets: list[SheetData]
    new_file_id: str | None = None

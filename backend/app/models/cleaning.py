"""
Internal representation of a workbook cleaning result.

Kept separate from schemas/ for the same reason as models/workbook.py and
models/analysis.py. `headers`/`rows` hold raw (not JSON-safe) values,
since they're also what gets written back to a new .xlsx file when the
result is committed — the API layer converts to JSON-safe types only for
the response preview.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class CleanedSheet:
    name: str
    original_row_count: int
    cleaned_row_count: int
    original_column_count: int
    cleaned_column_count: int
    rows_removed: int
    columns_removed: int
    cells_trimmed: int
    nulls_filled: int
    headers: list[Any]
    rows: list[list[Any]] = field(default_factory=list)


@dataclass
class WorkbookCleaningResult:
    file_id: str
    sheets: list[CleanedSheet]
    new_file_id: str | None = None

"""
Internal representation of a workbook formula result.

Kept separate from schemas/ for the same reason as the other models/
modules — the API response shape can evolve independently.
"""

from dataclasses import dataclass


@dataclass
class FormulaResult:
    file_id: str
    sheet_name: str
    range_applied: str
    cells_written: int
    computed_value: float | int | None = None
    new_file_id: str | None = None

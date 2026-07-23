"""
Internal representation of a workbook formatting result.

Kept separate from schemas/ for the same reason as the other models/
modules — the API response shape can evolve independently.
"""

from dataclasses import dataclass


@dataclass
class FormattingResult:
    file_id: str
    sheet_name: str
    range_applied: str
    cells_formatted: int
    new_file_id: str | None = None

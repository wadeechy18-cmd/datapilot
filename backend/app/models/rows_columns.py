"""
Internal representation of a rows/columns structural-edit result.

Kept separate from schemas/ for the same reason as the other models/
modules -- the API response shape can evolve independently.
"""

from dataclasses import dataclass


@dataclass
class RowColumnResult:
    file_id: str
    sheet_name: str
    action: str
    target: str
    position: int
    count: int
    new_row_count: int
    new_column_count: int
    new_file_id: str | None = None

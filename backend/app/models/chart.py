"""
Internal representation of a workbook chart result.

Kept separate from schemas/ for the same reason as the other models/
modules — the API response shape can evolve independently.
"""

from dataclasses import dataclass


@dataclass
class ChartResult:
    file_id: str
    sheet_name: str
    chart_type: str
    anchor: str
    title: str | None = None
    new_file_id: str | None = None

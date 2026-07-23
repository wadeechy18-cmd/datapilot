"""
Internal representation of a workbook's column-level data analysis.

Kept separate from schemas/ for the same reason as models/workbook.py — the
API response shape can evolve independently of this internal representation.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ColumnAnalysis:
    name: Any
    index: int
    inferred_type: str
    null_count: int
    unique_count: int
    min: Any = None
    max: Any = None
    mean: float | None = None
    sum: float | None = None


@dataclass
class SheetAnalysis:
    name: str
    columns: list[ColumnAnalysis] = field(default_factory=list)


@dataclass
class WorkbookAnalysis:
    file_id: str
    sheet_names: list[str]
    sheets: list[SheetAnalysis]

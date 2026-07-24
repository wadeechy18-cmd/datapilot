"""
Internal representation of a sheet's computed insights (outliers,
duplicates, trends, correlations).

Kept separate from schemas/ for the same reason as the other models/
modules -- the API response shape can evolve independently.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ColumnOutliers:
    column: Any
    outlier_count: int
    lower_bound: float
    upper_bound: float
    sample_values: list[float]


@dataclass
class ColumnTrend:
    column: Any
    direction: str  # "increasing" | "decreasing"
    strength: float  # correlation of the column's values against row order, -1..1


@dataclass
class ColumnCorrelation:
    column_a: Any
    column_b: Any
    correlation: float  # -1..1


@dataclass
class SheetInsights:
    file_id: str
    sheet_name: str
    duplicate_row_count: int
    outliers: list[ColumnOutliers] = field(default_factory=list)
    trends: list[ColumnTrend] = field(default_factory=list)
    correlations: list[ColumnCorrelation] = field(default_factory=list)

"""Pydantic schemas for the workbook insights endpoint."""

from typing import Any, Literal

from pydantic import BaseModel


class InsightsRequest(BaseModel):
    sheet_name: str | None = None  # omit for the workbook's first sheet


class ColumnOutliersSchema(BaseModel):
    column: Any
    outlier_count: int
    lower_bound: float
    upper_bound: float
    sample_values: list[float]


class ColumnTrendSchema(BaseModel):
    column: Any
    direction: Literal["increasing", "decreasing"]
    strength: float


class ColumnCorrelationSchema(BaseModel):
    column_a: Any
    column_b: Any
    correlation: float


class InsightsResponse(BaseModel):
    file_id: str
    sheet_name: str
    duplicate_row_count: int
    outliers: list[ColumnOutliersSchema]
    trends: list[ColumnTrendSchema]
    correlations: list[ColumnCorrelationSchema]

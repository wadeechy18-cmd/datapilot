"""Pydantic schemas for the workbook read endpoint."""

from typing import Any

from pydantic import BaseModel


class SheetSummary(BaseModel):
    name: str
    row_count: int
    column_count: int
    headers: list[Any]
    preview_rows: list[list[Any]]
    non_empty_cells: int = 0
    empty_cells: int = 0
    numeric_cells: int = 0
    text_cells: int = 0


class WorkbookSummaryResponse(BaseModel):
    file_id: str
    sheet_count: int
    sheet_names: list[str]
    sheets: list[SheetSummary]


class ColumnStats(BaseModel):
    name: Any
    index: int
    inferred_type: str
    null_count: int
    unique_count: int
    min: Any = None
    max: Any = None
    mean: float | None = None
    sum: float | None = None


class SheetAnalysis(BaseModel):
    name: str
    columns: list[ColumnStats]


class WorkbookAnalysisResponse(BaseModel):
    file_id: str
    sheet_count: int
    sheet_names: list[str]
    sheets: list[SheetAnalysis]

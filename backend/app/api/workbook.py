"""
Workbook read and analysis endpoints.

Given a file_id returned by /upload:
- /workbook/{file_id} returns the workbook's structure: sheet names,
  dimensions, headers, and a small data preview.
- /workbook/{file_id}/analysis returns per-column data analysis: inferred
  type, null/unique counts, and numeric aggregates.

Thin router — delegates to workbook_service.
"""

from fastapi import APIRouter, HTTPException, status

from app.models.analysis import WorkbookAnalysis
from app.models.workbook import WorkbookInfo
from app.schemas.workbook import (
    ColumnStats,
    SheetAnalysis,
    SheetSummary,
    WorkbookAnalysisResponse,
    WorkbookSummaryResponse,
)
from app.services.workbook_service import (
    WorkbookNotFoundError,
    get_workbook_analysis,
    get_workbook_summary,
)

router = APIRouter(tags=["workbook"])


def _serialize_summary(info: WorkbookInfo) -> WorkbookSummaryResponse:
    return WorkbookSummaryResponse(
        file_id=info.file_id,
        sheet_count=len(info.sheets),
        sheet_names=info.sheet_names,
        sheets=[
            SheetSummary(
                name=s.name,
                row_count=s.row_count,
                column_count=s.column_count,
                headers=s.headers,
                preview_rows=s.preview_rows,
                non_empty_cells=s.non_empty_cells,
                empty_cells=s.empty_cells,
                numeric_cells=s.numeric_cells,
                text_cells=s.text_cells,
            )
            for s in info.sheets
        ],
    )


def _serialize_analysis(info: WorkbookAnalysis) -> WorkbookAnalysisResponse:
    return WorkbookAnalysisResponse(
        file_id=info.file_id,
        sheet_count=len(info.sheets),
        sheet_names=info.sheet_names,
        sheets=[
            SheetAnalysis(
                name=sheet.name,
                columns=[
                    ColumnStats(
                        name=c.name,
                        index=c.index,
                        inferred_type=c.inferred_type,
                        null_count=c.null_count,
                        unique_count=c.unique_count,
                        min=c.min,
                        max=c.max,
                        mean=c.mean,
                        sum=c.sum,
                    )
                    for c in sheet.columns
                ],
            )
            for sheet in info.sheets
        ],
    )


@router.get("/workbook/{file_id}", response_model=WorkbookSummaryResponse)
def read_workbook_summary(file_id: str) -> WorkbookSummaryResponse:
    try:
        info = get_workbook_summary(file_id)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return _serialize_summary(info)


@router.get("/workbook/{file_id}/analysis", response_model=WorkbookAnalysisResponse)
def read_workbook_analysis(file_id: str) -> WorkbookAnalysisResponse:
    try:
        info = get_workbook_analysis(file_id)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return _serialize_analysis(info)

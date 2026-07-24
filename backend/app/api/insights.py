"""
Workbook insights endpoint.

POST /workbook/{file_id}/insights computes real, deterministic statistical
findings for one sheet -- outliers, duplicate rows, trends, correlations --
entirely locally (no AI, no cost). Read-only, same as Export/Summarize:
nothing is ever written back to storage.
"""

from fastapi import APIRouter, HTTPException, status

from app.models.insights import SheetInsights
from app.operations.insights import SheetNotFoundError
from app.schemas.insights import (
    ColumnCorrelationSchema,
    ColumnOutliersSchema,
    ColumnTrendSchema,
    InsightsRequest,
    InsightsResponse,
)
from app.services.insights_service import get_workbook_insights
from app.services.workbook_service import WorkbookNotFoundError
from app.utils.json_safe import to_json_safe

router = APIRouter(tags=["insights"])


def _serialize(insights: SheetInsights) -> InsightsResponse:
    return InsightsResponse(
        file_id=insights.file_id,
        sheet_name=insights.sheet_name,
        duplicate_row_count=insights.duplicate_row_count,
        outliers=[
            ColumnOutliersSchema(
                column=to_json_safe(o.column),
                outlier_count=o.outlier_count,
                lower_bound=o.lower_bound,
                upper_bound=o.upper_bound,
                sample_values=o.sample_values,
            )
            for o in insights.outliers
        ],
        trends=[
            ColumnTrendSchema(column=to_json_safe(t.column), direction=t.direction, strength=t.strength)
            for t in insights.trends
        ],
        correlations=[
            ColumnCorrelationSchema(
                column_a=to_json_safe(c.column_a), column_b=to_json_safe(c.column_b), correlation=c.correlation
            )
            for c in insights.correlations
        ],
    )


@router.post("/workbook/{file_id}/insights", response_model=InsightsResponse)
def get_insights_endpoint(file_id: str, request: InsightsRequest) -> InsightsResponse:
    try:
        insights = get_workbook_insights(file_id, request)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _serialize(insights)

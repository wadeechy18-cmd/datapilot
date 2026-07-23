"""
Workbook chart endpoint.

POST /workbook/{file_id}/chart embeds a native Excel chart (bar, line,
pie, area, or scatter) into a sheet, anchored at a given cell and
referencing existing cell data. Preview by default -- nothing is written
to the stored file. Pass ?commit=true to write the result to a new
file_id; the original file is left untouched.
"""

from fastapi import APIRouter, HTTPException, status

from app.models.chart import ChartResult
from app.operations.chart import InvalidRangeError, SheetNotFoundError
from app.schemas.chart import ChartRequest, ChartResponse
from app.services.chart_service import get_workbook_chart
from app.services.workbook_service import WorkbookNotFoundError

router = APIRouter(tags=["chart"])


def _serialize_chart(result: ChartResult) -> ChartResponse:
    return ChartResponse(
        file_id=result.file_id,
        new_file_id=result.new_file_id,
        sheet_name=result.sheet_name,
        chart_type=result.chart_type,
        anchor=result.anchor,
        title=result.title,
    )


@router.post("/workbook/{file_id}/chart", response_model=ChartResponse)
def apply_chart_endpoint(file_id: str, request: ChartRequest, commit: bool = False) -> ChartResponse:
    try:
        result = get_workbook_chart(file_id, request, commit=commit)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidRangeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _serialize_chart(result)

"""
Workbook formatting endpoint.

POST /workbook/{file_id}/format applies cell styling (font, fill, number
format, alignment, borders) to a sheet's whole used range, a specific
cell range, or just the header row, and returns a summary (range
applied, cells formatted) without touching the stored file. Pass
?commit=true to also write the styled result to a new file_id -- the
original file is left untouched.
"""

from fastapi import APIRouter, HTTPException, status

from app.models.formatting import FormattingResult
from app.operations.formatting import InvalidRangeError, SheetNotFoundError
from app.schemas.formatting import FormattingRequest, FormattingResponse
from app.services.formatting_service import get_workbook_formatting
from app.services.workbook_service import WorkbookNotFoundError

router = APIRouter(tags=["formatting"])


def _serialize_formatting(result: FormattingResult) -> FormattingResponse:
    return FormattingResponse(
        file_id=result.file_id,
        new_file_id=result.new_file_id,
        sheet_name=result.sheet_name,
        range_applied=result.range_applied,
        cells_formatted=result.cells_formatted,
    )


@router.post("/workbook/{file_id}/format", response_model=FormattingResponse)
def format_workbook_endpoint(file_id: str, request: FormattingRequest, commit: bool = False) -> FormattingResponse:
    try:
        result = get_workbook_formatting(file_id, request, commit=commit)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidRangeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _serialize_formatting(result)

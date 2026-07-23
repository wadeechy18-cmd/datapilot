"""
Workbook cleaning endpoint.

POST /workbook/{file_id}/clean runs the cleaning engine and returns a
preview (row/column counts, cells trimmed, nulls filled, a data preview)
without touching the stored file. Pass ?commit=true to also write the
cleaned result to a new file_id -- the original file is left untouched.
"""

from fastapi import APIRouter, HTTPException, status

from app.models.cleaning import WorkbookCleaningResult
from app.operations.cleaning import SheetNotFoundError
from app.schemas.cleaning import CleaningRequest, CleaningResponse, SheetCleaningSummary
from app.services.cleaning_service import get_workbook_cleaning
from app.services.workbook_service import WorkbookNotFoundError
from app.utils.json_safe import to_json_safe
from app.workbook.reader import PREVIEW_ROW_COUNT

router = APIRouter(tags=["cleaning"])


def _serialize_cleaning(result: WorkbookCleaningResult) -> CleaningResponse:
    return CleaningResponse(
        file_id=result.file_id,
        new_file_id=result.new_file_id,
        sheets=[
            SheetCleaningSummary(
                name=sheet.name,
                original_row_count=sheet.original_row_count,
                cleaned_row_count=sheet.cleaned_row_count,
                original_column_count=sheet.original_column_count,
                cleaned_column_count=sheet.cleaned_column_count,
                rows_removed=sheet.rows_removed,
                columns_removed=sheet.columns_removed,
                cells_trimmed=sheet.cells_trimmed,
                nulls_filled=sheet.nulls_filled,
                headers=[to_json_safe(h) for h in sheet.headers],
                preview_rows=[[to_json_safe(v) for v in row] for row in sheet.rows[:PREVIEW_ROW_COUNT]],
            )
            for sheet in result.sheets
        ],
    )


@router.post("/workbook/{file_id}/clean", response_model=CleaningResponse)
def clean_workbook_endpoint(file_id: str, request: CleaningRequest, commit: bool = False) -> CleaningResponse:
    try:
        result = get_workbook_cleaning(file_id, request, commit=commit)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _serialize_cleaning(result)

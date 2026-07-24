"""
Rows & columns structural-edit endpoint.

POST /workbook/{file_id}/rows-columns inserts or deletes whole rows or
columns on a sheet, and returns a summary (new row/column counts) without
touching the stored file. Pass ?commit=true to also write the edited result
to a new file_id -- the original file is left untouched.
"""

from fastapi import APIRouter, HTTPException, status

from app.models.rows_columns import RowColumnResult
from app.operations.rows_columns import InvalidPositionError, SheetNotFoundError
from app.schemas.rows_columns import RowColumnRequest, RowColumnResponse
from app.services.rows_columns_service import get_rows_columns_result
from app.services.workbook_service import WorkbookNotFoundError

router = APIRouter(tags=["rows-columns"])


def _serialize(result: RowColumnResult) -> RowColumnResponse:
    return RowColumnResponse(
        file_id=result.file_id,
        new_file_id=result.new_file_id,
        sheet_name=result.sheet_name,
        action=result.action,
        target=result.target,
        position=result.position,
        count=result.count,
        new_row_count=result.new_row_count,
        new_column_count=result.new_column_count,
    )


@router.post("/workbook/{file_id}/rows-columns", response_model=RowColumnResponse)
def rows_columns_endpoint(file_id: str, request: RowColumnRequest, commit: bool = False) -> RowColumnResponse:
    try:
        result = get_rows_columns_result(file_id, request, commit=commit)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidPositionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _serialize(result)

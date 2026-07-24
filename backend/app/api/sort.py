"""
Workbook sort endpoint.

POST /workbook/{file_id}/sort reorders a sheet's data rows by one column's
value (ascending or descending, optionally pinning a header row), and
returns a summary without touching the stored file. Pass ?commit=true to
also write the sorted result to a new file_id -- the original file is left
untouched. openpyxl has no native row-sort, so -- like the cleaning engine
-- this rebuilds the workbook rather than mutating in place, which means
cell styles/formulas on data rows are not preserved through a sort commit.
"""

from fastapi import APIRouter, HTTPException, status

from app.models.sort import WorkbookSortResult
from app.operations.sort import InvalidColumnError, SheetNotFoundError
from app.schemas.sort import SortRequest, SortResponse
from app.services.sort_service import get_workbook_sort
from app.services.workbook_service import WorkbookNotFoundError

router = APIRouter(tags=["sort"])


def _serialize(result: WorkbookSortResult) -> SortResponse:
    return SortResponse(
        file_id=result.file_id,
        new_file_id=result.new_file_id,
        sheet_name=result.sheet_name,
        column=result.column,
        ascending=result.ascending,
        has_header=result.has_header,
        row_count=result.row_count,
    )


@router.post("/workbook/{file_id}/sort", response_model=SortResponse)
def sort_workbook_endpoint(file_id: str, request: SortRequest, commit: bool = False) -> SortResponse:
    try:
        result = get_workbook_sort(file_id, request, commit=commit)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidColumnError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _serialize(result)

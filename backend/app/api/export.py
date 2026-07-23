"""
Workbook export endpoints.

GET /workbook/{file_id}/export/xlsx downloads the stored workbook
unchanged, as a real .xlsx file attachment -- the "download the result"
step after upload/clean/format/formula/chart.

GET /workbook/{file_id}/export/csv?sheet_name=... downloads a single
sheet's data flattened to CSV, for callers who just want the raw data.

Both are read-only: nothing here mutates a workbook or writes a new
file_id, so unlike the other engines there's no preview/commit split.
"""

from fastapi import APIRouter, HTTPException, Response, status

from app.operations.export import SheetNotFoundError
from app.services.export_service import get_sheet_csv, get_workbook_xlsx
from app.services.workbook_service import WorkbookNotFoundError

router = APIRouter(tags=["export"])

_XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _safe_filename_part(value: str) -> str:
    """Sanitize a user-supplied string (e.g. a sheet name) for use inside a
    Content-Disposition filename -- avoids header injection or a broken
    filename from characters like quotes, CR/LF, or path separators."""
    cleaned = "".join(c if c.isalnum() or c in "-_." else "_" for c in value)
    return cleaned or "sheet"


@router.get("/workbook/{file_id}/export/xlsx")
def export_xlsx_endpoint(file_id: str) -> Response:
    try:
        content = get_workbook_xlsx(file_id)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return Response(
        content=content,
        media_type=_XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{file_id}.xlsx"'},
    )


@router.get("/workbook/{file_id}/export/csv")
def export_csv_endpoint(file_id: str, sheet_name: str) -> Response:
    try:
        content = get_sheet_csv(file_id, sheet_name)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    filename = f"{file_id}_{_safe_filename_part(sheet_name)}.csv"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

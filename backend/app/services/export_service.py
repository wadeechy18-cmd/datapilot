"""
Export orchestration.

Resolves a file_id to a path (via storage_service) and hands it to the
export engine. Read-only -- unlike the other engines, there's nothing to
commit, since export never mutates the workbook.
"""

from pathlib import Path

from app.operations.export import export_sheet_csv, export_xlsx
from app.services import storage_service
from app.services.workbook_service import WorkbookNotFoundError


def _resolve_path(file_id: str) -> Path:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")
    return path


def get_workbook_xlsx(file_id: str) -> bytes:
    return export_xlsx(_resolve_path(file_id))


def get_sheet_csv(file_id: str, sheet_name: str) -> str:
    return export_sheet_csv(_resolve_path(file_id), sheet_name)

"""
Workbook orchestration.

Resolves a file_id to a path on disk (via storage_service) and hands it
to the workbook reader. This is the layer the API talks to — it doesn't
know about HTTP, and workbook/reader.py doesn't know about file_ids.
"""

from app.models.workbook import WorkbookInfo
from app.services import storage_service
from app.workbook.reader import read_workbook


class WorkbookNotFoundError(Exception):
    """Raised when no stored file matches the given file_id."""


def get_workbook_summary(file_id: str) -> WorkbookInfo:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")
    return read_workbook(file_id, path)

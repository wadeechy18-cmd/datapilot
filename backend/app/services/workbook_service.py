"""
Workbook orchestration.

Resolves a file_id to a path on disk (via storage_service) and hands it to
the workbook reader or data analyzer. This is the layer the API talks to —
it doesn't know about HTTP, and workbook/reader.py and analysis/analyzer.py
don't know about file_ids.
"""

from app.analysis.analyzer import analyze_workbook
from app.models.analysis import WorkbookAnalysis
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


def get_workbook_analysis(file_id: str) -> WorkbookAnalysis:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")
    return analyze_workbook(file_id, path)

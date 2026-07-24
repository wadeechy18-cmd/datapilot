"""
Sort orchestration.

Resolves a file_id to a path (via storage_service), runs the sort engine,
and -- only when the caller asks to commit -- writes the sorted result to a
brand new file_id. The original upload is never modified in place;
committing produces a sibling file instead of an overwrite.
"""

from app.models.sort import WorkbookSortResult
from app.operations.sort import sort_workbook, write_sorted_workbook
from app.schemas.sort import SortRequest
from app.services import storage_service
from app.services.workbook_service import WorkbookNotFoundError


def get_workbook_sort(file_id: str, request: SortRequest, commit: bool) -> WorkbookSortResult:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")

    result = sort_workbook(file_id, path, request)

    if commit:
        content = write_sorted_workbook(result)
        new_file_id, _ = storage_service.save_file(content, "sorted.xlsx")
        result.new_file_id = new_file_id

    return result

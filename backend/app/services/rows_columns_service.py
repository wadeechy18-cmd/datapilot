"""
Rows & columns orchestration.

Resolves a file_id to a path (via storage_service), runs the rows/columns
engine, and -- only when the caller asks to commit -- writes the edited
result to a brand new file_id. The original upload is never modified in
place; committing produces a sibling file instead of an overwrite.
"""

from app.models.rows_columns import RowColumnResult
from app.operations.rows_columns import apply_row_column_operation, write_rows_columns_workbook
from app.schemas.rows_columns import RowColumnRequest
from app.services import storage_service
from app.services.workbook_service import WorkbookNotFoundError


def get_rows_columns_result(file_id: str, request: RowColumnRequest, commit: bool) -> RowColumnResult:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")

    result, workbook = apply_row_column_operation(file_id, path, request)

    if commit:
        content = write_rows_columns_workbook(workbook)
        new_file_id, _ = storage_service.save_file(content, "edited.xlsx")
        result.new_file_id = new_file_id

    return result

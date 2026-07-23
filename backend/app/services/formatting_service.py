"""
Formatting orchestration.

Resolves a file_id to a path (via storage_service), runs the formatting
engine, and -- only when the caller asks to commit -- writes the styled
result to a brand new file_id. The original upload is never modified in
place; committing produces a sibling file instead of an overwrite.
"""

from app.models.formatting import FormattingResult
from app.operations.formatting import apply_formatting, write_formatted_workbook
from app.schemas.formatting import FormattingRequest
from app.services import storage_service
from app.services.workbook_service import WorkbookNotFoundError


def get_workbook_formatting(file_id: str, request: FormattingRequest, commit: bool) -> FormattingResult:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")

    result, workbook = apply_formatting(file_id, path, request)

    if commit:
        content = write_formatted_workbook(workbook)
        new_file_id, _ = storage_service.save_file(content, "formatted.xlsx")
        result.new_file_id = new_file_id

    return result

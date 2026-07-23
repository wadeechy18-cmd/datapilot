"""
Cleaning orchestration.

Resolves a file_id to a path (via storage_service), runs the cleaning
engine, and -- only when the caller asks to commit -- writes the cleaned
result to a brand new file_id. The original upload is never modified in
place; committing produces a sibling file instead of an overwrite.
"""

from app.models.cleaning import WorkbookCleaningResult
from app.operations.cleaning import clean_workbook, write_cleaned_workbook
from app.schemas.cleaning import CleaningRequest
from app.services import storage_service
from app.services.workbook_service import WorkbookNotFoundError


def get_workbook_cleaning(file_id: str, request: CleaningRequest, commit: bool) -> WorkbookCleaningResult:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")

    result = clean_workbook(file_id, path, request)

    if commit:
        content = write_cleaned_workbook(result)
        new_file_id, _ = storage_service.save_file(content, "cleaned.xlsx")
        result.new_file_id = new_file_id

    return result

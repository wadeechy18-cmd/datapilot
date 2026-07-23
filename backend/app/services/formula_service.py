"""
Formula orchestration.

Resolves a file_id to a path (via storage_service), runs the formula
engine, and -- only when the caller asks to commit -- writes the result
to a brand new file_id. The original upload is never modified in place;
committing produces a sibling file instead of an overwrite.
"""

from app.models.formula import FormulaResult
from app.operations.formula import apply_formula, write_formula_workbook
from app.schemas.formula import FormulaRequest
from app.services import storage_service
from app.services.workbook_service import WorkbookNotFoundError


def get_workbook_formula(file_id: str, request: FormulaRequest, commit: bool) -> FormulaResult:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")

    result, workbook = apply_formula(file_id, path, request)

    if commit:
        content = write_formula_workbook(workbook)
        new_file_id, _ = storage_service.save_file(content, "formula.xlsx")
        result.new_file_id = new_file_id

    return result

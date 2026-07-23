"""
Chart orchestration.

Resolves a file_id to a path (via storage_service), runs the chart
engine, and -- only when the caller asks to commit -- writes the result
to a brand new file_id. The original upload is never modified in place;
committing produces a sibling file instead of an overwrite.
"""

from app.models.chart import ChartResult
from app.operations.chart import build_chart, write_chart_workbook
from app.schemas.chart import ChartRequest
from app.services import storage_service
from app.services.workbook_service import WorkbookNotFoundError


def get_workbook_chart(file_id: str, request: ChartRequest, commit: bool) -> ChartResult:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")

    result, workbook = build_chart(file_id, path, request)

    if commit:
        content = write_chart_workbook(workbook)
        new_file_id, _ = storage_service.save_file(content, "chart.xlsx")
        result.new_file_id = new_file_id

    return result

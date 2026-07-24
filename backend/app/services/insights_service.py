"""
Insights orchestration.

Resolves a file_id to a path (via storage_service) and runs the insights
engine. Entirely local -- no AI provider involved, nothing is ever written
to storage.
"""

from app.models.insights import SheetInsights
from app.operations.insights import compute_insights
from app.schemas.insights import InsightsRequest
from app.services import storage_service
from app.services.workbook_service import WorkbookNotFoundError


def get_workbook_insights(file_id: str, request: InsightsRequest) -> SheetInsights:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")

    return compute_insights(file_id, path, request.sheet_name)

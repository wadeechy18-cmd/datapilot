"""
AI summary orchestration.

Resolves a file_id to a path (via storage_service), gets the configured
AIProvider (via the factory -- swappable, see app/ai/factory.py), and runs
the summary engine. Read-only: nothing is ever written back to storage.
"""

from app.ai.factory import get_ai_provider
from app.models.ai_summary import AISummaryResult
from app.operations.ai_summary import summarize_workbook
from app.schemas.ai_summary import AISummaryRequest
from app.services import storage_service
from app.services.workbook_service import WorkbookNotFoundError


async def get_ai_summary(file_id: str, request: AISummaryRequest) -> AISummaryResult:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")

    provider = get_ai_provider()
    return await summarize_workbook(file_id, path, provider, request.sheet_name)

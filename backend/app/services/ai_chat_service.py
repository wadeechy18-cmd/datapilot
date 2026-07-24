"""
AI chat orchestration.

Resolves a file_id to a path, asks operations/ai_chat.py to interpret the
message as either a reply or a validated action request, and -- for
actions -- dispatches to the SAME service function each existing engine's
own API endpoint already uses, with commit=True. The AI never writes to the
workbook itself; only these existing, already-tested service functions do.
"""

from app.ai.factory import get_ai_provider
from app.operations.ai_chat import chat_with_workbook
from app.schemas.ai_chat import ChatRequest, ChatResponse
from app.services import storage_service
from app.services.chart_service import get_workbook_chart
from app.services.cleaning_service import get_workbook_cleaning
from app.services.formatting_service import get_workbook_formatting
from app.services.formula_service import get_workbook_formula
from app.services.rows_columns_service import get_rows_columns_result
from app.services.sort_service import get_workbook_sort
from app.services.workbook_service import WorkbookNotFoundError

_ACTION_DISPATCH = {
    "format": get_workbook_formatting,
    "clean": get_workbook_cleaning,
    "formula": get_workbook_formula,
    "chart": get_workbook_chart,
    "rows_columns": get_rows_columns_result,
    "sort": get_workbook_sort,
}


async def get_ai_chat_response(file_id: str, request: ChatRequest) -> ChatResponse:
    path = storage_service.get_path(file_id)
    if not path.exists():
        raise WorkbookNotFoundError(f"No workbook found for file_id '{file_id}'.")

    provider = get_ai_provider()
    action = await chat_with_workbook(file_id, path, provider, request)

    if action.kind == "reply":
        return ChatResponse(reply=action.message)

    dispatch = _ACTION_DISPATCH.get(action.kind)
    if dispatch is None:
        return ChatResponse(reply=action.message)

    result = dispatch(file_id, action.request, commit=True)
    return ChatResponse(reply=action.message, new_file_id=result.new_file_id, engine=action.kind)

"""
AI chat endpoint.

POST /workbook/{file_id}/chat sends one conversation turn to the configured
AI provider. The AI can either reply conversationally, or propose ONE
action -- which, if it validates against the same schema the ribbon/command
bar already use, is executed through that engine's existing service and
commits a new file_id, same as every other engine (the original is never
overwritten).
"""

from fastapi import APIRouter, HTTPException, status

from app.ai.provider import AIProviderError
from app.operations.ai_chat import SheetNotFoundError
from app.schemas.ai_chat import ChatRequest, ChatResponse
from app.services.ai_chat_service import get_ai_chat_response
from app.services.workbook_service import WorkbookNotFoundError

router = APIRouter(tags=["ai"])


@router.post("/workbook/{file_id}/chat", response_model=ChatResponse)
async def chat_with_workbook_endpoint(file_id: str, request: ChatRequest) -> ChatResponse:
    try:
        return await get_ai_chat_response(file_id, request)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

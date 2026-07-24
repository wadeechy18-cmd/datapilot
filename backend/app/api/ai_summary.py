"""
AI-generated sheet summary endpoint.

POST /workbook/{file_id}/summarize asks the configured AI provider (Gemini
by default, see app/ai/) for a short plain-English summary of one sheet,
built only from already-computed column statistics -- never raw cell data.
Read-only, same as Export: nothing is ever written back to storage.
"""

from fastapi import APIRouter, HTTPException, status

from app.ai.provider import AIProviderError
from app.models.ai_summary import AISummaryResult
from app.operations.ai_summary import SheetNotFoundError
from app.schemas.ai_summary import AISummaryRequest, AISummaryResponse
from app.services.ai_summary_service import get_ai_summary
from app.services.workbook_service import WorkbookNotFoundError

router = APIRouter(tags=["ai"])


def _serialize(result: AISummaryResult) -> AISummaryResponse:
    return AISummaryResponse(file_id=result.file_id, sheet_name=result.sheet_name, summary=result.summary)


@router.post("/workbook/{file_id}/summarize", response_model=AISummaryResponse)
async def summarize_workbook_endpoint(file_id: str, request: AISummaryRequest) -> AISummaryResponse:
    try:
        result = await get_ai_summary(file_id, request)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return _serialize(result)

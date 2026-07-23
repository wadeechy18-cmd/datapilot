"""
Excel upload endpoint.

Thin by design: reads the file, delegates validation/storage to
upload_service, and translates the result into an HTTP response.
"""

from fastapi import APIRouter, HTTPException, UploadFile, status

from app.schemas.upload import UploadResponse
from app.services.upload_service import UploadValidationError, process_upload

router = APIRouter(tags=["upload"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_workbook(file: UploadFile) -> UploadResponse:
    content = await file.read()

    try:
        saved = process_upload(file, content)
    except UploadValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return UploadResponse(
        file_id=saved.file_id,
        original_filename=saved.original_filename,
        size_bytes=saved.size_bytes,
    )

"""
Upload validation and orchestration.

Validates an incoming file (extension, size, that it's actually a readable
xlsx workbook) and hands valid content to storage_service. Deliberately
does NOT parse sheet data or content — that's the Workbook Reader
milestone's job. This module only answers "is this a file we can accept?"
"""

import io
from dataclasses import dataclass
from pathlib import Path

import openpyxl
from fastapi import UploadFile

from app.core.config import get_settings
from app.services import storage_service


class UploadValidationError(Exception):
    """Raised when an uploaded file fails validation."""


@dataclass
class SavedUpload:
    file_id: str
    original_filename: str
    stored_path: Path
    size_bytes: int


def _validate_extension(filename: str) -> None:
    settings = get_settings()
    suffix = Path(filename).suffix.lower()
    if suffix not in settings.ALLOWED_UPLOAD_EXTENSIONS:
        allowed = ", ".join(settings.ALLOWED_UPLOAD_EXTENSIONS)
        raise UploadValidationError(f"Unsupported file type '{suffix}'. Allowed: {allowed}")


def _validate_size(content: bytes) -> None:
    settings = get_settings()
    if len(content) > settings.max_upload_size_bytes:
        raise UploadValidationError(
            f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB upload limit."
        )
    if len(content) == 0:
        raise UploadValidationError("Uploaded file is empty.")


def _validate_is_readable_workbook(content: bytes) -> None:
    """Confirm the bytes are actually a valid Excel workbook, not just a
    file with an .xlsx extension. We open and immediately close it —
    reading sheet data is out of scope here."""
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
        workbook.close()
    except Exception as exc:  # openpyxl raises various exception types for bad files
        raise UploadValidationError("File could not be read as a valid Excel workbook.") from exc


def process_upload(file: UploadFile, content: bytes) -> SavedUpload:
    """Validate an uploaded file and persist it. Raises UploadValidationError
    on any validation failure; caller maps that to an HTTP response."""
    if not file.filename:
        raise UploadValidationError("Uploaded file has no filename.")

    _validate_extension(file.filename)
    _validate_size(content)
    _validate_is_readable_workbook(content)

    file_id, stored_path = storage_service.save_file(content, file.filename)

    return SavedUpload(
        file_id=file_id,
        original_filename=file.filename,
        stored_path=stored_path,
        size_bytes=len(content),
    )

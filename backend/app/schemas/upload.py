"""Pydantic schemas for the upload endpoint."""

from pydantic import BaseModel


class UploadResponse(BaseModel):
    file_id: str
    original_filename: str
    size_bytes: int


class UploadErrorResponse(BaseModel):
    detail: str

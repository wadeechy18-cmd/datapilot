"""Pydantic schemas for the AI sheet-summary endpoint."""

from pydantic import BaseModel


class AISummaryRequest(BaseModel):
    sheet_name: str | None = None  # omit for the workbook's first sheet


class AISummaryResponse(BaseModel):
    file_id: str
    sheet_name: str
    summary: str

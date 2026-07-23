"""Pydantic schemas for the health endpoint."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str

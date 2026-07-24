"""Pydantic schemas for the AI chat endpoint."""

from typing import Literal

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    sheet_name: str
    selection: str | None = None  # e.g. "A1:C3"; omit for "whole sheet"
    # Stateless, like the rest of this app: the client keeps the transcript
    # and resends it each turn (including the new user message as the last
    # entry) -- there's no database yet to persist chat history server-side.
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str
    new_file_id: str | None = None
    engine: str | None = None  # which engine ran, if the AI proposed and executed an action

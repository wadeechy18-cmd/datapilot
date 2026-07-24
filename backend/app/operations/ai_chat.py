"""
AI chat.

Interprets one user message, in the context of a running conversation, as
either a conversational reply or a proposed action on the sheet. Like the
summary engine, this only ever sees column-level statistics, never raw cell
data. Unlike the summary engine, a chat turn can propose an action -- but
this module never executes anything itself: it only ever produces a
*validated* Pydantic request object for one of the existing engines
(format/clean/formula/chart/rows_columns/sort), reusing their exact
existing schemas. Executing that request through the same service each
engine's own API endpoint already uses is services/ai_chat_service.py's
job. The AI never touches the workbook directly -- if its response isn't
valid JSON, names an action that doesn't exist, or fails schema validation,
this falls back to a plain reply instead of guessing or crashing.
"""

import json
import re
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.ai.provider import AIProvider
from app.analysis.analyzer import analyze_workbook
from app.models.ai_chat import ChatAction
from app.models.analysis import ColumnAnalysis
from app.models.insights import SheetInsights
from app.operations.insights import compute_insights, format_insights_for_prompt
from app.schemas.ai_chat import ChatMessage, ChatRequest
from app.schemas.chart import ChartRequest
from app.schemas.cleaning import CleaningRequest
from app.schemas.formatting import FormattingRequest
from app.schemas.formula import FormulaRequest
from app.schemas.rows_columns import RowColumnRequest
from app.schemas.sort import SortRequest


class SheetNotFoundError(Exception):
    """Raised when the requested sheet_name doesn't exist in the workbook."""


_MAX_HISTORY_MESSAGES = 10

_ACTION_SCHEMAS: dict[str, type] = {
    "format": FormattingRequest,
    "clean": CleaningRequest,
    "formula": FormulaRequest,
    "chart": ChartRequest,
    "rows_columns": RowColumnRequest,
    "sort": SortRequest,
}

_FENCE_RE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)

_ACTION_SPEC = """\
- "format": sheet_name, range (e.g. "A1:C3" or null), header_row (bool), \
bold/italic (bool or null), font_size (number or null), font_color/fill_color \
(hex string like "#FFFF00" or null), number_format (string or null), \
horizontal_alignment ("left"/"center"/"right"/"justify" or null), \
vertical_alignment ("top"/"center"/"bottom" or null), border_style \
("thin"/"medium"/"thick" or null), border_color (hex or null). \
IMPORTANT: range and header_row are mutually exclusive -- if header_row is \
true, range MUST be null (omitted), never a guessed value like "A1:C1".
- "clean": sheet_name (or null for all sheets), trim_whitespace, \
drop_empty_rows, drop_empty_columns, drop_duplicate_rows (all bool), \
drop_rows_with_nulls (bool), fill_nulls (null, or {"strategy": \
"zero"/"mean"/"mode"/"placeholder", "placeholder": any})
- "formula": sheet_name, range (destination range for a fill-down formula, \
or null), formula (a string starting with "=", or null), cell (destination \
cell for a function, or null), function ("SUM"/"AVERAGE"/"COUNT"/"MIN"/"MAX" \
or null), source_range (source range for function mode, or null)
- "chart": sheet_name, chart_type ("bar"/"line"/"pie"/"area"/"scatter"), \
anchor (a cell like "E2", or null), title (string or null), data_range (or \
null), categories_range (or null), x_range/y_range (scatter only, or null)
- "rows_columns": sheet_name, action ("insert" or "delete"), target ("row" \
or "column"), position (1-based number), reference \
("above"/"below" for rows, "left"/"right" for columns -- required for \
insert, must be omitted for delete), count (number, default 1)
- "sort": sheet_name, column (a letter like "B"), ascending (bool), \
has_header (bool)
"""


def _format_column(column: ColumnAnalysis) -> str:
    line = f"- {column.name!r}: type={column.inferred_type}, nulls={column.null_count}, unique={column.unique_count}"
    if column.inferred_type == "numeric" and column.mean is not None:
        line += f", min={column.min}, max={column.max}, mean={column.mean:.2f}, sum={column.sum}"
    return line


def _format_history(messages: list[ChatMessage]) -> str:
    return "\n".join(f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}" for m in messages)


def _build_prompt(
    sheet_name: str,
    columns: list[ColumnAnalysis],
    insights: SheetInsights,
    selection: str | None,
    messages: list[ChatMessage],
) -> str:
    column_lines = "\n".join(_format_column(c) for c in columns)
    selection_desc = selection or "whole sheet (no specific range selected)"
    history = _format_history(messages)

    return (
        "You are an assistant embedded in a spreadsheet tool for non-technical users "
        "(accountants, students, freelancers). You can answer questions about the sheet, "
        "or perform ONE action on it per turn. You are only ever given column-level "
        "statistics and a list of computed findings below, never the actual cell data -- "
        "when asked about patterns/outliers/trends, use the computed findings, don't "
        "guess your own.\n\n"
        "Respond with ONLY a single JSON object and nothing else -- no markdown code "
        "fences, no explanation outside the JSON.\n\n"
        'To just answer or chat, respond exactly:\n{"action": "reply", "message": "<your answer>"}\n\n'
        'To perform an action, pick exactly one action type below and fill in "request" '
        "with fields matching that type (use null/omit fields you don't need). Always "
        'also include a short "message" describing what you\'re doing.\n\n'
        f"{_ACTION_SPEC}\n"
        'Respond: {"action": "<reply|format|clean|formula|chart|rows_columns|sort>", '
        '"request": {...} (omit for "reply"), "message": "<short description>"}\n\n'
        "If you're not confident an action request is valid or the user's intent is "
        'unclear, respond with "reply" instead and ask a clarifying question -- never '
        "guess at a destructive action.\n\n"
        f"Sheet: {sheet_name}\n"
        f"Selection: {selection_desc}\n"
        f"Columns:\n{column_lines}\n\n"
        f"Computed findings:\n{format_insights_for_prompt(insights)}\n\n"
        f"Conversation so far:\n{history}\n"
        "Assistant:"
    )


def _parse_json_response(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    fence_match = _FENCE_RE.match(text)
    if fence_match:
        text = fence_match.group(1)
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None
    return parsed if isinstance(parsed, dict) else None


async def interpret_message(
    provider: AIProvider,
    sheet_name: str,
    columns: list[ColumnAnalysis],
    insights: SheetInsights,
    selection: str | None,
    messages: list[ChatMessage],
) -> ChatAction:
    prompt = _build_prompt(sheet_name, columns, insights, selection, messages[-_MAX_HISTORY_MESSAGES:])
    raw = await provider.generate_text(prompt)

    parsed = _parse_json_response(raw)
    if parsed is None:
        return ChatAction(kind="reply", message=raw.strip())

    action = parsed.get("action")
    message = parsed.get("message") or raw.strip()

    if action in (None, "reply"):
        return ChatAction(kind="reply", message=message)

    schema_cls = _ACTION_SCHEMAS.get(action)
    if schema_cls is None:
        return ChatAction(kind="reply", message=message)

    try:
        validated = schema_cls.model_validate(parsed.get("request") or {})
    except ValidationError:
        return ChatAction(
            kind="reply",
            message=(
                f"I tried to {action.replace('_', ' ')} but couldn't build a valid "
                "request for it, so nothing changed. Could you rephrase?"
            ),
        )

    return ChatAction(kind=action, message=message, request=validated)


async def chat_with_workbook(file_id: str, path: Path, provider: AIProvider, request: ChatRequest) -> ChatAction:
    analysis = analyze_workbook(file_id, path)
    sheet = next((s for s in analysis.sheets if s.name == request.sheet_name), None)
    if sheet is None:
        raise SheetNotFoundError(f"Sheet '{request.sheet_name}' not found in workbook '{file_id}'.")

    insights = compute_insights(file_id, path, sheet.name)
    return await interpret_message(provider, sheet.name, sheet.columns, insights, request.selection, request.messages)

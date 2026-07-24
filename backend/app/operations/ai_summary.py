"""
AI-generated sheet summary.

Builds a prompt from the *already-computed* column analysis (types, null/
unique counts, min/max/mean/sum -- never raw cell rows) plus the insights
engine's computed findings (real outliers/duplicates/trends/correlations,
not the AI's own guesswork) and asks the configured AIProvider for a
plain-English summary. Data minimization by construction: the AI never
sees actual cell values, only aggregate shape, per the project's AI
architecture policy.
"""

from pathlib import Path

from app.ai.provider import AIProvider
from app.analysis.analyzer import analyze_workbook
from app.models.ai_summary import AISummaryResult
from app.models.analysis import ColumnAnalysis
from app.models.insights import SheetInsights
from app.operations.insights import compute_insights, format_insights_for_prompt


class SheetNotFoundError(Exception):
    """Raised when the requested sheet_name doesn't exist in the workbook."""


def _format_column(column: ColumnAnalysis) -> str:
    line = f"- {column.name!r}: type={column.inferred_type}, nulls={column.null_count}, unique={column.unique_count}"
    if column.inferred_type == "numeric" and column.mean is not None:
        line += f", min={column.min}, max={column.max}, mean={column.mean:.2f}, sum={column.sum}"
    return line


def _build_prompt(sheet_name: str, columns: list[ColumnAnalysis], insights: SheetInsights) -> str:
    column_lines = "\n".join(_format_column(c) for c in columns)
    return (
        "You are summarizing a spreadsheet for a non-technical user (an accountant, "
        "student, or freelancer). You are given only column-level statistics and a list "
        "of computed findings, not the actual data. Write a short (3-5 sentence) "
        "plain-English summary of what this sheet likely contains, weaving in the "
        "computed findings below where relevant (e.g. mention real outliers/trends/"
        "duplicates, don't invent your own). Do not invent specific values you weren't "
        "given.\n\n"
        f"Sheet: {sheet_name}\n"
        f"Columns:\n{column_lines}\n\n"
        f"Computed findings:\n{format_insights_for_prompt(insights)}\n"
    )


async def summarize_workbook(
    file_id: str, path: Path, provider: AIProvider, sheet_name: str | None
) -> AISummaryResult:
    analysis = analyze_workbook(file_id, path)

    target_name = sheet_name or analysis.sheet_names[0]
    sheet = next((s for s in analysis.sheets if s.name == target_name), None)
    if sheet is None:
        raise SheetNotFoundError(f"Sheet '{target_name}' not found in workbook '{file_id}'.")

    insights = compute_insights(file_id, path, sheet.name)
    prompt = _build_prompt(sheet.name, sheet.columns, insights)
    summary = await provider.generate_text(prompt)

    return AISummaryResult(file_id=file_id, sheet_name=sheet.name, summary=summary)

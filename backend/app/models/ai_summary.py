"""
Internal representation of an AI-generated sheet summary.

Kept separate from schemas/ for the same reason as the other models/
modules -- the API response shape can evolve independently.
"""

from dataclasses import dataclass


@dataclass
class AISummaryResult:
    file_id: str
    sheet_name: str
    summary: str

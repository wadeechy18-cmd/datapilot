"""Pydantic schemas for the workbook sort endpoint."""

import re

from pydantic import BaseModel, field_validator

_COLUMN_LETTERS_RE = re.compile(r"^[A-Za-z]+$")


class SortRequest(BaseModel):
    sheet_name: str
    column: str  # a column letter, e.g. "B"
    ascending: bool = True
    has_header: bool = True  # if True, row 1 is pinned and excluded from the sort

    @field_validator("column")
    @classmethod
    def _validate_column(cls, value: str) -> str:
        if not _COLUMN_LETTERS_RE.match(value):
            raise ValueError("column must be letters only, e.g. 'B'.")
        return value.upper()


class SortResponse(BaseModel):
    file_id: str
    new_file_id: str | None = None
    sheet_name: str
    column: str
    ascending: bool
    has_header: bool
    row_count: int

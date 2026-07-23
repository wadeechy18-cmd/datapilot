"""Pydantic schemas for the workbook formatting endpoint."""

import re
from typing import Literal

from pydantic import BaseModel, model_validator

_HEX_COLOR_RE = re.compile(r"^#?[0-9A-Fa-f]{6}$")


class FormattingRequest(BaseModel):
    sheet_name: str
    range: str | None = None  # e.g. "A1:C10"; omit for the sheet's whole used range
    header_row: bool = False  # convenience: target row 1 only; mutually exclusive with range

    bold: bool | None = None
    italic: bool | None = None
    font_size: float | None = None
    font_color: str | None = None  # hex, e.g. "#FFFFFF" or "FFFFFF"
    fill_color: str | None = None
    number_format: str | None = None  # openpyxl number format code, e.g. "0.00%"
    horizontal_alignment: Literal["left", "center", "right", "justify"] | None = None
    vertical_alignment: Literal["top", "center", "bottom"] | None = None
    border_style: Literal["thin", "medium", "thick"] | None = None
    border_color: str | None = None  # requires border_style

    @model_validator(mode="after")
    def _validate(self) -> "FormattingRequest":
        if self.header_row and self.range is not None:
            raise ValueError("header_row and range are mutually exclusive.")

        style_fields = (
            self.bold,
            self.italic,
            self.font_size,
            self.font_color,
            self.fill_color,
            self.number_format,
            self.horizontal_alignment,
            self.vertical_alignment,
            self.border_style,
        )
        if all(value is None for value in style_fields):
            raise ValueError("At least one style property must be set.")

        if self.border_color is not None and self.border_style is None:
            raise ValueError("border_color requires border_style to be set.")

        for name, value in (
            ("font_color", self.font_color),
            ("fill_color", self.fill_color),
            ("border_color", self.border_color),
        ):
            if value is not None and not _HEX_COLOR_RE.match(value):
                raise ValueError(f"{name} must be a hex color like '#RRGGBB'.")

        return self


class FormattingResponse(BaseModel):
    file_id: str
    new_file_id: str | None = None
    sheet_name: str
    range_applied: str
    cells_formatted: int

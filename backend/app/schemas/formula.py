"""Pydantic schemas for the workbook formula endpoint."""

from typing import Literal

from pydantic import BaseModel, model_validator


class FormulaRequest(BaseModel):
    sheet_name: str

    # Mode 1 ("template"): a formula string applied across a range, with
    # {row}/{col} relative-reference substitution -- any valid Excel
    # formula works, e.g. "=SUM(A{row}:C{row})".
    range: str | None = None
    formula: str | None = None

    # Mode 2 ("function"): a convenience aggregate written to a single
    # cell; the result is also computed locally over literal values in
    # source_range, since openpyxl itself can't evaluate formulas.
    cell: str | None = None
    function: Literal["SUM", "AVERAGE", "COUNT", "MIN", "MAX"] | None = None
    source_range: str | None = None

    @model_validator(mode="after")
    def _validate(self) -> "FormulaRequest":
        template_fields_set = self.range is not None or self.formula is not None
        function_fields_set = self.cell is not None or self.function is not None or self.source_range is not None

        if template_fields_set and function_fields_set:
            raise ValueError("Use either 'range'+'formula' or 'cell'+'function'+'source_range', not both.")

        if template_fields_set:
            if self.range is None or self.formula is None:
                raise ValueError("Both 'range' and 'formula' are required together.")
            if not self.formula.startswith("="):
                raise ValueError("formula must start with '='.")
        elif function_fields_set:
            if self.cell is None or self.function is None or self.source_range is None:
                raise ValueError("'cell', 'function', and 'source_range' are all required together.")
        else:
            raise ValueError("Provide either 'range'+'formula' or 'cell'+'function'+'source_range'.")

        return self


class FormulaResponse(BaseModel):
    file_id: str
    new_file_id: str | None = None
    sheet_name: str
    range_applied: str
    cells_written: int
    computed_value: float | int | None = None

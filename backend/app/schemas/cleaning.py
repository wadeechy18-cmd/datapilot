"""Pydantic schemas for the workbook cleaning endpoint."""

from typing import Any, Literal

from pydantic import BaseModel, model_validator


class FillNullsRequest(BaseModel):
    strategy: Literal["zero", "mean", "mode", "placeholder"]
    # Only used when strategy == "placeholder"; "zero"/"mean" only fill
    # columns that are entirely numeric, "mode" fills with the column's
    # most common non-null value regardless of type.
    placeholder: Any = None


class CleaningRequest(BaseModel):
    sheet_name: str | None = None
    trim_whitespace: bool = False
    drop_empty_rows: bool = False
    drop_empty_columns: bool = False
    drop_duplicate_rows: bool = False
    drop_rows_with_nulls: bool = False
    fill_nulls: FillNullsRequest | None = None

    @model_validator(mode="after")
    def _validate_null_handling(self) -> "CleaningRequest":
        if self.drop_rows_with_nulls and self.fill_nulls is not None:
            raise ValueError("drop_rows_with_nulls and fill_nulls are mutually exclusive.")
        if (
            self.fill_nulls is not None
            and self.fill_nulls.strategy == "placeholder"
            and self.fill_nulls.placeholder is None
        ):
            raise ValueError("fill_nulls.placeholder is required when strategy is 'placeholder'.")
        return self


class SheetCleaningSummary(BaseModel):
    name: str
    original_row_count: int
    cleaned_row_count: int
    original_column_count: int
    cleaned_column_count: int
    rows_removed: int
    columns_removed: int
    cells_trimmed: int
    nulls_filled: int
    headers: list[Any]
    preview_rows: list[list[Any]]


class CleaningResponse(BaseModel):
    file_id: str
    new_file_id: str | None = None
    sheets: list[SheetCleaningSummary]

"""Pydantic schemas for the rows/columns structural-edit endpoint."""

from typing import Literal

from pydantic import BaseModel, model_validator


class RowColumnRequest(BaseModel):
    sheet_name: str
    action: Literal["insert", "delete"]
    target: Literal["row", "column"]
    position: int  # 1-based row number or column number
    # Required for "insert" (which side of `position` the new row/column goes);
    # must be omitted for "delete", since deleting only needs a position.
    reference: Literal["above", "below", "left", "right"] | None = None
    count: int = 1  # how many rows/columns to insert or delete

    @model_validator(mode="after")
    def _validate(self) -> "RowColumnRequest":
        if self.position < 1:
            raise ValueError("position must be 1 or greater.")
        if self.count < 1:
            raise ValueError("count must be 1 or greater.")

        if self.action == "insert":
            if self.reference is None:
                raise ValueError("reference is required when action is 'insert'.")
            valid_references = ("above", "below") if self.target == "row" else ("left", "right")
            if self.reference not in valid_references:
                raise ValueError(f"reference must be one of {valid_references} when target is '{self.target}'.")
        elif self.reference is not None:
            raise ValueError("reference is only used when action is 'insert'.")

        return self


class RowColumnResponse(BaseModel):
    file_id: str
    new_file_id: str | None = None
    sheet_name: str
    action: str
    target: str
    position: int
    count: int
    new_row_count: int
    new_column_count: int

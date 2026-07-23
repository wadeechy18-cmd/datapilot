"""Pydantic schemas for the workbook chart endpoint."""

from typing import Literal

from pydantic import BaseModel, model_validator


class ChartRequest(BaseModel):
    sheet_name: str
    chart_type: Literal["bar", "line", "pie", "area", "scatter"]
    anchor: str = "E2"
    title: str | None = None

    # bar / line / pie / area: a data range (first row = series titles)
    # plus an optional categories range for axis / slice labels.
    data_range: str | None = None
    categories_range: str | None = None

    # scatter only: explicit x/y value ranges, since ScatterChart series
    # carry xvalues and yvalues separately rather than a single data range.
    x_range: str | None = None
    y_range: str | None = None

    @model_validator(mode="after")
    def _validate(self) -> "ChartRequest":
        if self.chart_type == "scatter":
            if self.data_range is not None or self.categories_range is not None:
                raise ValueError("Scatter charts use 'x_range'/'y_range', not 'data_range'/'categories_range'.")
            if self.x_range is None or self.y_range is None:
                raise ValueError("Scatter charts require both 'x_range' and 'y_range'.")
        else:
            if self.x_range is not None or self.y_range is not None:
                raise ValueError("'x_range'/'y_range' only apply to scatter charts; use 'data_range' instead.")
            if self.data_range is None:
                raise ValueError("'data_range' is required for bar/line/pie/area charts.")
        return self


class ChartResponse(BaseModel):
    file_id: str
    new_file_id: str | None = None
    sheet_name: str
    chart_type: str
    anchor: str
    title: str | None = None

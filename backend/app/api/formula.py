"""
Workbook formula endpoint.

POST /workbook/{file_id}/formula writes formulas into a sheet's cells:
either a formula template applied across a range (with {row}/{col}
relative-reference substitution), or a convenience aggregate
(SUM/AVERAGE/COUNT/MIN/MAX) written to a single cell, whose computed
value is returned directly. Preview by default -- nothing is written to
the stored file. Pass ?commit=true to write the result to a new
file_id; the original file is left untouched.
"""

from fastapi import APIRouter, HTTPException, status

from app.models.formula import FormulaResult
from app.operations.formula import InvalidRangeError, SheetNotFoundError
from app.schemas.formula import FormulaRequest, FormulaResponse
from app.services.formula_service import get_workbook_formula
from app.services.workbook_service import WorkbookNotFoundError

router = APIRouter(tags=["formula"])


def _serialize_formula(result: FormulaResult) -> FormulaResponse:
    return FormulaResponse(
        file_id=result.file_id,
        new_file_id=result.new_file_id,
        sheet_name=result.sheet_name,
        range_applied=result.range_applied,
        cells_written=result.cells_written,
        computed_value=result.computed_value,
    )


@router.post("/workbook/{file_id}/formula", response_model=FormulaResponse)
def apply_formula_endpoint(file_id: str, request: FormulaRequest, commit: bool = False) -> FormulaResponse:
    try:
        result = get_workbook_formula(file_id, request, commit=commit)
    except WorkbookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SheetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidRangeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _serialize_formula(result)

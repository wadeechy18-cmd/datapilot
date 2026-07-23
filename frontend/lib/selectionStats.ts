import { selectionBounds, type SelectionRange } from "@/lib/range";
import type { CellValue, SheetSummary } from "@/lib/types";

/** Reads a sheet cell by 1-based grid coordinates (row 1 = header row, matching
 * the backend reader). Shared by the grid, chart preview, and status bar --
 * anywhere that needs a value out of the already-loaded preview data. */
export function cellAt(sheet: SheetSummary, row: number, col: number): CellValue {
  if (row === 1) return sheet.headers[col - 1] ?? null;
  return sheet.preview_rows[row - 2]?.[col - 1] ?? null;
}

export function toNumber(value: CellValue): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type SelectionStats = { cellCount: number; numericCount: number; sum: number; average: number | null };

/** Sum/average/count for the status bar, computed client-side from
 * already-loaded data. Returns null (not a fabricated number) for an "all"
 * selection, since that targets rows/columns that were never loaded. */
export function computeSelectionStats(sheet: SheetSummary, selection: SelectionRange): SelectionStats | null {
  const bounds = selectionBounds(selection);
  if (!bounds) return null;

  let cellCount = 0;
  let numericCount = 0;
  let sum = 0;
  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      cellCount += 1;
      const value = toNumber(cellAt(sheet, row, col));
      if (value !== null) {
        numericCount += 1;
        sum += value;
      }
    }
  }

  return { cellCount, numericCount, sum, average: numericCount > 0 ? sum / numericCount : null };
}

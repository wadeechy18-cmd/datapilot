export type RangeBounds = { minCol: number; minRow: number; maxCol: number; maxRow: number };

function columnLettersToIndex(letters: string): number {
  let index = 0;
  for (const ch of letters.toUpperCase()) {
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
  return index;
}

function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!match) return null;
  return { col: columnLettersToIndex(match[1]), row: parseInt(match[2], 10) };
}

/** Parses an Excel-style range ("A1:C10" or a single cell "A1") into 1-based row/col bounds. */
export function parseRange(ref: string): RangeBounds | null {
  const parts = ref.split(":");
  if (parts.length === 1) {
    const cell = parseCellRef(parts[0]);
    if (!cell) return null;
    return { minCol: cell.col, minRow: cell.row, maxCol: cell.col, maxRow: cell.row };
  }
  if (parts.length !== 2) return null;
  const a = parseCellRef(parts[0]);
  const b = parseCellRef(parts[1]);
  if (!a || !b) return null;
  return {
    minCol: Math.min(a.col, b.col),
    maxCol: Math.max(a.col, b.col),
    minRow: Math.min(a.row, b.row),
    maxRow: Math.max(a.row, b.row),
  };
}

/** Reverse of columnLettersToIndex: 1 -> "A", 26 -> "Z", 27 -> "AA". */
export function columnIndexToLetters(index: number): string {
  let letters = "";
  let n = index;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** 1-based grid coordinates. Row 1 is the header row, matching the backend
 * reader (worksheet row N is grid row N exactly, no offset). */
export type CellCoord = { row: number; col: number };

export function cellRef(coord: CellCoord): string {
  return `${columnIndexToLetters(coord.col)}${coord.row}`;
}

/** A grid selection: either a rectangular anchor/focus drag, or "all" -- what
 * clicking the grid's top-left corner cell produces, matching real Excel's
 * select-all-cells behavior. "all" has no bounds, since it targets the whole
 * sheet including rows/columns never loaded into the preview. */
export type SelectionRange = { kind: "range"; anchor: CellCoord; focus: CellCoord } | { kind: "all" };

export function selectionBounds(selection: SelectionRange): RangeBounds | null {
  if (selection.kind === "all") return null;
  const { anchor, focus } = selection;
  return {
    minCol: Math.min(anchor.col, focus.col),
    maxCol: Math.max(anchor.col, focus.col),
    minRow: Math.min(anchor.row, focus.row),
    maxRow: Math.max(anchor.row, focus.row),
  };
}

/** Converts a selection into an "A1" (single cell) or "A1:C10" (range) string
 * for the backend's range-based request fields. Returns null for "all". */
export function selectionToRangeRef(selection: SelectionRange): string | null {
  const bounds = selectionBounds(selection);
  if (!bounds) return null;
  const start = cellRef({ row: bounds.minRow, col: bounds.minCol });
  const end = cellRef({ row: bounds.maxRow, col: bounds.maxCol });
  return start === end ? start : `${start}:${end}`;
}

function clampCoord(coord: CellCoord, maxRow: number, maxCol: number): CellCoord {
  return {
    row: Math.min(Math.max(coord.row, 1), maxRow),
    col: Math.min(Math.max(coord.col, 1), maxCol),
  };
}

/** Keeps a selection inside a sheet's current bounds -- needed after a commit
 * (e.g. Cleaning dropping rows/columns) that may shrink the sheet out from
 * under a previously-valid selection. */
export function clampSelection(selection: SelectionRange, maxRow: number, maxCol: number): SelectionRange {
  if (selection.kind === "all") return selection;
  return {
    kind: "range",
    anchor: clampCoord(selection.anchor, maxRow, maxCol),
    focus: clampCoord(selection.focus, maxRow, maxCol),
  };
}

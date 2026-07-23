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

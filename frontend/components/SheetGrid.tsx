import { useRef, type CSSProperties, type KeyboardEvent } from "react";

import { columnIndexToLetters, selectionBounds, type CellCoord, type SelectionRange, type RangeBounds } from "@/lib/range";
import type { CellValue, SheetSummary } from "@/lib/types";

export type CellStyleTarget = { kind: "header" } | { kind: "whole" } | { kind: "range"; bounds: RangeBounds };

export type CellStyleOverride = {
  target: CellStyleTarget;
  style: CSSProperties;
};

type SheetGridProps = {
  sheet: SheetSummary;
  selection: SelectionRange;
  onSelectionChange: (selection: SelectionRange) => void;
  styleOverride?: CellStyleOverride | null;
};

function formatCell(value: CellValue): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

function matchesStyleTarget(target: CellStyleTarget, row: number, col: number): boolean {
  if (target.kind === "whole") return true;
  if (target.kind === "header") return row === 1;
  const { bounds } = target;
  return row >= bounds.minRow && row <= bounds.maxRow && col >= bounds.minCol && col <= bounds.maxCol;
}

function cellAt(sheet: SheetSummary, row: number, col: number): CellValue {
  if (row === 1) return sheet.headers[col - 1] ?? null;
  return sheet.preview_rows[row - 2]?.[col - 1] ?? null;
}

export function SheetGrid({ sheet, selection, onSelectionChange, styleOverride }: SheetGridProps) {
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxRow = 1 + sheet.preview_rows.length;
  const maxCol = Math.max(
    sheet.headers.length,
    sheet.column_count,
    ...sheet.preview_rows.map((row) => row.length),
    1
  );

  const bounds = selectionBounds(selection);
  const isAll = selection.kind === "all";

  const isSelected = (row: number, col: number): boolean => {
    if (isAll) return true;
    if (!bounds) return false;
    return row >= bounds.minRow && row <= bounds.maxRow && col >= bounds.minCol && col <= bounds.maxCol;
  };

  const selectionStyleFor = (row: number, col: number): CSSProperties => {
    if (!isSelected(row, col)) return {};
    const style: CSSProperties = { backgroundColor: "var(--selection-fill)" };
    if (bounds) {
      if (row === bounds.minRow) style.borderTop = "2px solid var(--selection-border)";
      if (row === bounds.maxRow) style.borderBottom = "2px solid var(--selection-border)";
      if (col === bounds.minCol) style.borderLeft = "2px solid var(--selection-border)";
      if (col === bounds.maxCol) style.borderRight = "2px solid var(--selection-border)";
    }
    return style;
  };

  const overrideStyleFor = (row: number, col: number): CSSProperties =>
    styleOverride && matchesStyleTarget(styleOverride.target, row, col) ? styleOverride.style : {};

  const startSelection = (coord: CellCoord) => {
    isDragging.current = true;
    onSelectionChange({ kind: "range", anchor: coord, focus: coord });
  };

  const extendSelection = (coord: CellCoord) => {
    if (!isDragging.current) return;
    const anchor = selection.kind === "range" ? selection.anchor : coord;
    onSelectionChange({ kind: "range", anchor, focus: coord });
  };

  const handleCellMouseDown = (row: number, col: number, shiftKey: boolean) => {
    if (shiftKey) {
      const anchor = selection.kind === "range" ? selection.anchor : { row, col };
      onSelectionChange({ kind: "range", anchor, focus: { row, col } });
      return;
    }
    startSelection({ row, col });
  };

  const selectColumn = (col: number) => {
    onSelectionChange({ kind: "range", anchor: { row: 1, col }, focus: { row: maxRow, col } });
  };

  const selectRow = (row: number) => {
    onSelectionChange({ kind: "range", anchor: { row, col: 1 }, focus: { row, col: maxCol } });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current: CellCoord =
      selection.kind === "range" ? selection.focus : { row: 1, col: 1 };
    const clamp = (coord: CellCoord): CellCoord => ({
      row: Math.min(Math.max(coord.row, 1), maxRow),
      col: Math.min(Math.max(coord.col, 1), maxCol),
    });

    let next: CellCoord | null = null;
    if (event.key === "ArrowUp") next = clamp({ row: current.row - 1, col: current.col });
    else if (event.key === "ArrowDown") next = clamp({ row: current.row + 1, col: current.col });
    else if (event.key === "ArrowLeft") next = clamp({ row: current.row, col: current.col - 1 });
    else if (event.key === "ArrowRight") next = clamp({ row: current.row, col: current.col + 1 });
    else if (event.key === "Enter") next = clamp({ row: current.row + 1, col: current.col });
    else if (event.key === "Tab") next = clamp({ row: current.row, col: current.col + 1 });
    if (!next) return;

    event.preventDefault();
    if (event.shiftKey && (event.key.startsWith("Arrow"))) {
      const anchor = selection.kind === "range" ? selection.anchor : current;
      onSelectionChange({ kind: "range", anchor, focus: next });
    } else {
      onSelectionChange({ kind: "range", anchor: next, focus: next });
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={() => containerRef.current?.focus()}
      onMouseUp={() => {
        isDragging.current = false;
      }}
      onMouseLeave={() => {
        isDragging.current = false;
      }}
      className="overflow-x-auto rounded border border-excel-gridline outline-none focus:ring-2 focus:ring-excel-green"
    >
      <table className="min-w-full select-none border-collapse text-left text-sm">
        <thead>
          <tr>
            <th
              onClick={() => onSelectionChange({ kind: "all" })}
              className="w-10 cursor-pointer border border-excel-headerBorder bg-excel-headerBg"
            />
            {Array.from({ length: maxCol }, (_, i) => i + 1).map((col) => (
              <th
                key={col}
                onClick={() => selectColumn(col)}
                className={
                  "cursor-pointer whitespace-nowrap border border-excel-headerBorder px-3 py-1 text-center font-normal text-neutral-600 " +
                  (bounds && col >= bounds.minCol && col <= bounds.maxCol ? "bg-excel-green/20 font-semibold" : "bg-excel-headerBg")
                }
              >
                {columnIndexToLetters(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRow }, (_, i) => i + 1).map((row) => (
            <tr key={row}>
              <th
                onClick={() => selectRow(row)}
                className={
                  "w-10 cursor-pointer whitespace-nowrap border border-excel-headerBorder px-2 py-1 text-center font-normal text-neutral-600 " +
                  (bounds && row >= bounds.minRow && row <= bounds.maxRow ? "bg-excel-green/20 font-semibold" : "bg-excel-headerBg")
                }
              >
                {row}
              </th>
              {Array.from({ length: maxCol }, (_, i) => i + 1).map((col) => (
                <td
                  key={col}
                  onMouseDown={(e) => handleCellMouseDown(row, col, e.shiftKey)}
                  onMouseEnter={() => extendSelection({ row, col })}
                  style={{ ...overrideStyleFor(row, col), ...selectionStyleFor(row, col) }}
                  className="min-w-[6rem] cursor-cell whitespace-nowrap border border-excel-gridline px-3 py-1 text-neutral-900"
                >
                  {formatCell(cellAt(sheet, row, col))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { CSSProperties } from "react";

import type { RangeBounds } from "@/lib/range";
import type { CellValue, SheetSummary } from "@/lib/types";

export type CellStyleTarget = { kind: "header" } | { kind: "whole" } | { kind: "range"; bounds: RangeBounds };

export type CellStyleOverride = {
  target: CellStyleTarget;
  style: CSSProperties;
};

function formatCell(value: CellValue): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

/** row/col are 1-based, Excel-style (row 1 = header row). */
function matchesTarget(target: CellStyleTarget, row: number, col: number): boolean {
  if (target.kind === "whole") return true;
  if (target.kind === "header") return row === 1;
  const { bounds } = target;
  return row >= bounds.minRow && row <= bounds.maxRow && col >= bounds.minCol && col <= bounds.maxCol;
}

export function WorkbookTable({
  sheet,
  styleOverride,
}: {
  sheet: SheetSummary;
  styleOverride?: CellStyleOverride | null;
}) {
  const styleFor = (row: number, col: number): CSSProperties | undefined =>
    styleOverride && matchesTarget(styleOverride.target, row, col) ? styleOverride.style : undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-4">
        <div className="rounded bg-slate-900 px-3 py-2">Non-empty cells: {sheet.non_empty_cells}</div>
        <div className="rounded bg-slate-900 px-3 py-2">Empty cells: {sheet.empty_cells}</div>
        <div className="rounded bg-slate-900 px-3 py-2">Numeric cells: {sheet.numeric_cells}</div>
        <div className="rounded bg-slate-900 px-3 py-2">Text cells: {sheet.text_cells}</div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-900">
            <tr>
              {sheet.headers.map((header, index) => (
                <th
                  key={index}
                  style={styleFor(1, index + 1)}
                  className="whitespace-nowrap px-3 py-2 font-semibold text-slate-200"
                >
                  {formatCell(header) || `Column ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sheet.preview_rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-slate-950/40 even:bg-slate-900/40">
                {row.map((value, cellIndex) => (
                  <td
                    key={cellIndex}
                    style={styleFor(rowIndex + 2, cellIndex + 1)}
                    className="whitespace-nowrap px-3 py-2 text-slate-200"
                  >
                    {formatCell(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.preview_rows.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-400">This sheet has no data rows beyond the header.</p>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        Showing {sheet.preview_rows.length} preview row(s) of {sheet.row_count} total.
      </p>
    </div>
  );
}

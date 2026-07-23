"use client";

import { useState } from "react";

import { useEngineAction } from "@/hooks/useEngineAction";
import { API_BASE_URL } from "@/lib/api";
import { cellRef, selectionBounds, selectionToRangeRef, type SelectionRange } from "@/lib/range";
import type { FormulaFunction, FormulaRequest, FormulaResponse } from "@/lib/types";

type Mode = "template" | "function";

type FormulasTabProps = {
  fileId: string;
  activeSheet: string;
  selection: SelectionRange;
  onApplied: (newFileId: string) => void;
};

export function FormulasTab({ fileId, activeSheet, selection, onApplied }: FormulasTabProps) {
  const [mode, setMode] = useState<Mode>("template");
  const [formula, setFormula] = useState("");
  const [fn, setFn] = useState<FormulaFunction>("SUM");

  const { isRunning, result, error, run } = useEngineAction<FormulaRequest, FormulaResponse>(
    `/workbook/${fileId}/formula`,
    onApplied
  );

  const bounds = selectionBounds(selection);
  const destinationRange = selectionToRangeRef(selection);
  // AutoSum-style placement: one row below the selection, in its rightmost column.
  const destinationCell = bounds ? cellRef({ row: bounds.maxRow + 1, col: bounds.maxCol }) : null;

  const isReady =
    mode === "template" ? destinationRange !== null && formula.trim().startsWith("=") : destinationRange !== null;

  const buildRequest = (): FormulaRequest =>
    mode === "template"
      ? { sheet_name: activeSheet, range: destinationRange ?? "", formula: formula.trim() }
      : {
          sheet_name: activeSheet,
          cell: destinationCell ?? "",
          function: fn,
          source_range: destinationRange ?? "",
        };

  const downloadUrl = result?.new_file_id ? `${API_BASE_URL}/api/v1/workbook/${result.new_file_id}/export/xlsx` : null;

  return (
    <div className="p-4">
      <p className="text-sm text-neutral-500">
        Applies to sheet <span className="font-medium text-neutral-800">{activeSheet}</span>. openpyxl writes formulas
        but can&apos;t calculate them, so the grid above will show these cells as blank until the file is opened in
        Excel — the computed result (for aggregate functions) is shown below instead. You can also type a formula
        directly into the formula bar above the grid.
      </p>

      {!bounds ? (
        <p className="mt-3 text-sm text-amber-600">Select a specific range in the grid first (not the whole sheet).</p>
      ) : null}

      <div className="mt-4 flex gap-4 text-sm text-neutral-800">
        <label className="flex items-center gap-2">
          <input type="radio" name="formula-mode" checked={mode === "template"} onChange={() => setMode("template")} />
          Fill formula across selection
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="formula-mode" checked={mode === "function"} onChange={() => setMode("function")} />
          AutoSum / aggregate function
        </label>
      </div>

      {mode === "template" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-neutral-800">
            Destination range (from grid selection):{" "}
            <span className="font-medium text-neutral-900">{destinationRange ?? "—"}</span>
          </p>
          <label className="block text-sm text-neutral-800">
            Formula ({"{row}"}/{"{col}"} are substituted per cell)
            <input
              type="text"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="e.g. =SUM(A{row}:C{row})"
              className="mt-1 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </label>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <p className="text-sm text-neutral-800">
              Source range: <span className="font-medium text-neutral-900">{destinationRange ?? "—"}</span>
            </p>
            <label className="block text-sm text-neutral-800">
              Function
              <select
                value={fn}
                onChange={(e) => setFn(e.target.value as FormulaFunction)}
                className="mt-1 block rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
              >
                <option value="SUM">SUM</option>
                <option value="AVERAGE">AVERAGE</option>
                <option value="COUNT">COUNT</option>
                <option value="MIN">MIN</option>
                <option value="MAX">MAX</option>
              </select>
            </label>
            <p className="text-sm text-neutral-800">
              Writes to: <span className="font-medium text-neutral-900">{destinationCell ?? "—"}</span>
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isRunning || !isReady}
          onClick={() => run(buildRequest(), false)}
          className="rounded border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? "Working..." : "Preview"}
        </button>
        <button
          type="button"
          disabled={isRunning || !result}
          onClick={() => run(buildRequest(), true)}
          className="rounded bg-excel-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-excel-greenDark disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          Apply (write new file)
        </button>
        {downloadUrl ? (
          <a href={downloadUrl} className="text-sm font-medium text-excel-green underline hover:text-excel-greenDark">
            Download .xlsx
          </a>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded border border-excel-gridline bg-neutral-50 p-4 text-sm text-neutral-800">
          <p>
            Wrote formula(s) to <span className="font-medium text-neutral-900">{result.range_applied}</span> (
            {result.cells_written} cell{result.cells_written === 1 ? "" : "s"}).
          </p>
          {result.computed_value !== null ? (
            <p className="mt-1">
              Computed result: <span className="font-medium text-neutral-900">{result.computed_value}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

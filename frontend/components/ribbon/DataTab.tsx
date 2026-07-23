"use client";

import { useState } from "react";

import { useEngineAction } from "@/hooks/useEngineAction";
import type { CleaningRequest, CleaningResponse, FillNullsStrategy } from "@/lib/types";

type NullHandling = "none" | "drop" | "fill";

type DataTabProps = {
  fileId: string;
  sheetNames: string[];
  activeSheet: string;
  onCommitted: (newFileId: string) => void;
};

export function DataTab({ fileId, sheetNames, activeSheet, onCommitted }: DataTabProps) {
  const [applyToAllSheets, setApplyToAllSheets] = useState(false);
  const [trimWhitespace, setTrimWhitespace] = useState(false);
  const [dropEmptyRows, setDropEmptyRows] = useState(false);
  const [dropEmptyColumns, setDropEmptyColumns] = useState(false);
  const [dropDuplicateRows, setDropDuplicateRows] = useState(false);
  const [nullHandling, setNullHandling] = useState<NullHandling>("none");
  const [fillStrategy, setFillStrategy] = useState<FillNullsStrategy>("zero");
  const [placeholder, setPlaceholder] = useState("");

  const { isRunning, result, error, run } = useEngineAction<CleaningRequest, CleaningResponse>(
    `/workbook/${fileId}/clean`,
    onCommitted
  );

  const buildRequest = (): CleaningRequest => ({
    sheet_name: applyToAllSheets ? null : activeSheet,
    trim_whitespace: trimWhitespace,
    drop_empty_rows: dropEmptyRows,
    drop_empty_columns: dropEmptyColumns,
    drop_duplicate_rows: dropDuplicateRows,
    drop_rows_with_nulls: nullHandling === "drop",
    fill_nulls:
      nullHandling === "fill"
        ? { strategy: fillStrategy, placeholder: fillStrategy === "placeholder" ? placeholder : undefined }
        : null,
  });

  const targetedSheet = result?.sheets.find((sheet) => sheet.name === activeSheet) ?? null;

  return (
    <div className="p-4">
      <p className="text-sm text-neutral-500">
        Applies to sheet <span className="font-medium text-neutral-800">{applyToAllSheets ? "all sheets" : activeSheet}</span>.
        Preview first, then apply to write a cleaned copy. Not selection-driven — cleaning always targets a whole
        sheet (or all sheets), never an arbitrary range.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input type="checkbox" checked={trimWhitespace} onChange={(e) => setTrimWhitespace(e.target.checked)} />
            Trim whitespace
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input type="checkbox" checked={dropEmptyRows} onChange={(e) => setDropEmptyRows(e.target.checked)} />
            Drop empty rows
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={dropEmptyColumns}
              onChange={(e) => setDropEmptyColumns(e.target.checked)}
            />
            Drop empty columns
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={dropDuplicateRows}
              onChange={(e) => setDropDuplicateRows(e.target.checked)}
            />
            Drop duplicate rows
          </label>
          {sheetNames.length > 1 ? (
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                checked={applyToAllSheets}
                onChange={(e) => setApplyToAllSheets(e.target.checked)}
              />
              Apply to all sheets
            </label>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">Missing values</p>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="radio"
              name="null-handling"
              checked={nullHandling === "none"}
              onChange={() => setNullHandling("none")}
            />
            Leave as-is
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="radio"
              name="null-handling"
              checked={nullHandling === "drop"}
              onChange={() => setNullHandling("drop")}
            />
            Drop rows with any missing value
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="radio"
              name="null-handling"
              checked={nullHandling === "fill"}
              onChange={() => setNullHandling("fill")}
            />
            Fill missing values
          </label>

          {nullHandling === "fill" ? (
            <div className="ml-6 space-y-2">
              <select
                value={fillStrategy}
                onChange={(e) => setFillStrategy(e.target.value as FillNullsStrategy)}
                className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
              >
                <option value="zero">Zero (numeric columns)</option>
                <option value="mean">Mean (numeric columns)</option>
                <option value="mode">Most common value</option>
                <option value="placeholder">Placeholder value</option>
              </select>
              {fillStrategy === "placeholder" ? (
                <input
                  type="text"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  placeholder="e.g. N/A"
                  className="block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isRunning}
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
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {targetedSheet ? (
        <div className="mt-4 rounded border border-excel-gridline bg-neutral-50 p-4 text-sm text-neutral-800">
          <p className="font-medium text-neutral-900">Preview: {targetedSheet.name}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div>
              Rows: {targetedSheet.original_row_count} → {targetedSheet.cleaned_row_count} (
              {targetedSheet.rows_removed} removed)
            </div>
            <div>
              Columns: {targetedSheet.original_column_count} → {targetedSheet.cleaned_column_count} (
              {targetedSheet.columns_removed} removed)
            </div>
            <div>
              Cells trimmed: {targetedSheet.cells_trimmed}, nulls filled: {targetedSheet.nulls_filled}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

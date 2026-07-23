"use client";

import { useState } from "react";

import type { CleaningRequest, CleaningResponse, FillNullsStrategy } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type NullHandling = "none" | "drop" | "fill";

type CleaningPanelProps = {
  fileId: string;
  sheetNames: string[];
  activeSheet: string;
  onCommitted: (newFileId: string) => void;
};

export function CleaningPanel({ fileId, sheetNames, activeSheet, onCommitted }: CleaningPanelProps) {
  const [applyToAllSheets, setApplyToAllSheets] = useState(false);
  const [trimWhitespace, setTrimWhitespace] = useState(false);
  const [dropEmptyRows, setDropEmptyRows] = useState(false);
  const [dropEmptyColumns, setDropEmptyColumns] = useState(false);
  const [dropDuplicateRows, setDropDuplicateRows] = useState(false);
  const [nullHandling, setNullHandling] = useState<NullHandling>("none");
  const [fillStrategy, setFillStrategy] = useState<FillNullsStrategy>("zero");
  const [placeholder, setPlaceholder] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleaningResponse | null>(null);

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

  const run = async (commit: boolean) => {
    setIsRunning(true);
    setError(null);
    if (!commit) {
      setResult(null);
    }

    try {
      const url = `${API_BASE_URL}/api/v1/workbook/${fileId}/clean${commit ? "?commit=true" : ""}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest()),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Cleaning request failed.");
      }

      setResult(payload);
      if (commit && payload.new_file_id) {
        onCommitted(payload.new_file_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsRunning(false);
    }
  };

  const targetedSheet = result?.sheets.find((sheet) => sheet.name === activeSheet) ?? null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
      <h2 className="text-xl font-semibold">Clean data</h2>
      <p className="mt-1 text-sm text-slate-400">
        Applies to sheet <span className="font-medium text-slate-200">{applyToAllSheets ? "all sheets" : activeSheet}</span>.
        Preview first, then apply to write a cleaned copy.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={trimWhitespace} onChange={(e) => setTrimWhitespace(e.target.checked)} />
            Trim whitespace
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={dropEmptyRows} onChange={(e) => setDropEmptyRows(e.target.checked)} />
            Drop empty rows
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={dropEmptyColumns}
              onChange={(e) => setDropEmptyColumns(e.target.checked)}
            />
            Drop empty columns
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={dropDuplicateRows}
              onChange={(e) => setDropDuplicateRows(e.target.checked)}
            />
            Drop duplicate rows
          </label>
          {sheetNames.length > 1 ? (
            <label className="flex items-center gap-2 text-sm text-slate-200">
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
          <p className="text-sm font-medium text-slate-300">Missing values</p>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="radio"
              name="null-handling"
              checked={nullHandling === "none"}
              onChange={() => setNullHandling("none")}
            />
            Leave as-is
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="radio"
              name="null-handling"
              checked={nullHandling === "drop"}
              onChange={() => setNullHandling("drop")}
            />
            Drop rows with any missing value
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
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
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
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
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isRunning}
          onClick={() => run(false)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? "Working..." : "Preview"}
        </button>
        <button
          type="button"
          disabled={isRunning || !result}
          onClick={() => run(true)}
          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Apply (write new file)
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}

      {targetedSheet ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200">
          <p className="font-medium text-slate-100">Preview: {targetedSheet.name}</p>
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

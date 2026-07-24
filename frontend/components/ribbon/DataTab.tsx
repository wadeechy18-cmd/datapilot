"use client";

import { useEffect, useState } from "react";

import { useEngineAction } from "@/hooks/useEngineAction";
import { columnIndexToLetters, selectionBounds, type SelectionRange } from "@/lib/range";
import type {
  CleaningRequest,
  CleaningResponse,
  RowColumnReference,
  RowColumnRequest,
  RowColumnResponse,
  RowColumnTarget,
  SortRequest,
  SortResponse,
} from "@/lib/types";

type NullHandling = "none" | "drop" | "fill";

type DataTabProps = {
  fileId: string;
  sheetNames: string[];
  activeSheet: string;
  selection: SelectionRange;
  onCommitted: (newFileId: string) => void;
};

function RowsColumnsSection({
  fileId,
  activeSheet,
  selection,
  onCommitted,
}: {
  fileId: string;
  activeSheet: string;
  selection: SelectionRange;
  onCommitted: (newFileId: string) => void;
}) {
  const [target, setTarget] = useState<RowColumnTarget>("row");
  const [action, setAction] = useState<"insert" | "delete">("insert");
  const [reference, setReference] = useState<RowColumnReference>("above");

  const { isRunning, result, error, run } = useEngineAction<RowColumnRequest, RowColumnResponse>(
    `/workbook/${fileId}/rows-columns`,
    onCommitted
  );

  const bounds = selectionBounds(selection);

  // Insert anchors on the near edge of the selection in the requested
  // direction (top for "above", bottom for "below", etc); delete always
  // targets the whole selection span, so a multi-row/column selection
  // removes all of it in one action.
  const position = bounds
    ? action === "insert"
      ? reference === "above" || reference === "left"
        ? target === "row"
          ? bounds.minRow
          : bounds.minCol
        : target === "row"
          ? bounds.maxRow
          : bounds.maxCol
      : target === "row"
        ? bounds.minRow
        : bounds.minCol
    : null;
  const count = bounds ? (target === "row" ? bounds.maxRow - bounds.minRow + 1 : bounds.maxCol - bounds.minCol + 1) : 1;

  const targetLabel = (() => {
    if (!bounds) return "—";
    if (target === "row") {
      return bounds.minRow === bounds.maxRow ? `row ${bounds.minRow}` : `rows ${bounds.minRow}-${bounds.maxRow}`;
    }
    const startLetter = columnIndexToLetters(bounds.minCol);
    const endLetter = columnIndexToLetters(bounds.maxCol);
    return startLetter === endLetter ? `column ${startLetter}` : `columns ${startLetter}-${endLetter}`;
  })();

  const buildRequest = (): RowColumnRequest => ({
    sheet_name: activeSheet,
    action,
    target,
    position: position ?? 1,
    reference: action === "insert" ? reference : undefined,
    count: action === "delete" ? count : 1,
  });

  useEffect(() => {
    setReference(target === "row" ? "above" : "left");
  }, [target]);

  const isReady = bounds !== null;

  return (
    <div className="border-t border-excel-gridline pt-4">
      <p className="text-sm font-medium text-neutral-700">Rows &amp; Columns</p>
      <p className="mt-1 text-sm text-neutral-500">
        {isReady ? (
          <>
            {action === "insert" ? "Insert a " : "Delete "}
            <span className="font-medium text-neutral-800">{target}</span>
            {action === "insert" ? (
              <>
                {" "}
                {reference} <span className="font-medium text-neutral-800">{targetLabel}</span>
              </>
            ) : (
              <> — <span className="font-medium text-neutral-800">{targetLabel}</span></>
            )}
          </>
        ) : (
          "Select a specific row, column, or range in the grid first (not the whole sheet)."
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-800">
        <label className="flex items-center gap-2">
          <input type="radio" name="rc-action" checked={action === "insert"} onChange={() => setAction("insert")} />
          Insert
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="rc-action" checked={action === "delete"} onChange={() => setAction("delete")} />
          Delete
        </label>

        <span className="mx-2 text-neutral-300">|</span>

        <label className="flex items-center gap-2">
          <input type="radio" name="rc-target" checked={target === "row"} onChange={() => setTarget("row")} />
          Row
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="rc-target" checked={target === "column"} onChange={() => setTarget("column")} />
          Column
        </label>

        {action === "insert" ? (
          <>
            <span className="mx-2 text-neutral-300">|</span>
            {target === "row" ? (
              <>
                <label className="flex items-center gap-2">
                  <input type="radio" name="rc-reference" checked={reference === "above"} onChange={() => setReference("above")} />
                  Above
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="rc-reference" checked={reference === "below"} onChange={() => setReference("below")} />
                  Below
                </label>
              </>
            ) : (
              <>
                <label className="flex items-center gap-2">
                  <input type="radio" name="rc-reference" checked={reference === "left"} onChange={() => setReference("left")} />
                  Left
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="rc-reference" checked={reference === "right"} onChange={() => setReference("right")} />
                  Right
                </label>
              </>
            )}
          </>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
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
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {result ? (
        <p className="mt-3 text-sm text-neutral-700">
          New sheet size: {result.new_row_count} row(s) × {result.new_column_count} column(s).
        </p>
      ) : null}
    </div>
  );
}

function SortSection({
  fileId,
  activeSheet,
  selection,
  onCommitted,
}: {
  fileId: string;
  activeSheet: string;
  selection: SelectionRange;
  onCommitted: (newFileId: string) => void;
}) {
  const [column, setColumn] = useState("A");
  const [ascending, setAscending] = useState(true);
  const [hasHeader, setHasHeader] = useState(true);

  const { isRunning, result, error, run } = useEngineAction<SortRequest, SortResponse>(
    `/workbook/${fileId}/sort`,
    onCommitted
  );

  useEffect(() => {
    const bounds = selectionBounds(selection);
    if (bounds) setColumn(columnIndexToLetters(bounds.minCol));
  }, [selection]);

  const buildRequest = (): SortRequest => ({
    sheet_name: activeSheet,
    column: column.trim().toUpperCase(),
    ascending,
    has_header: hasHeader,
  });

  const isReady = /^[A-Za-z]+$/.test(column.trim());

  return (
    <div className="border-t border-excel-gridline pt-4">
      <p className="text-sm font-medium text-neutral-700">Sort</p>
      <p className="mt-1 text-sm text-neutral-500">
        Reorders sheet <span className="font-medium text-neutral-800">{activeSheet}</span>&apos;s data rows by one
        column. Data-only: cell styling on that sheet is not preserved through a sort.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-800">
        <label className="flex items-center gap-2">
          Column
          <input
            type="text"
            value={column}
            onChange={(e) => setColumn(e.target.value)}
            className="w-16 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </label>

        <label className="flex items-center gap-2">
          <input type="radio" name="sort-direction" checked={ascending} onChange={() => setAscending(true)} />
          Ascending
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="sort-direction" checked={!ascending} onChange={() => setAscending(false)} />
          Descending
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
          Has header row (keep row 1 pinned)
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
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
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {result ? <p className="mt-3 text-sm text-neutral-700">Sorted {result.row_count} row(s).</p> : null}
    </div>
  );
}

export function DataTab({ fileId, sheetNames, activeSheet, selection, onCommitted }: DataTabProps) {
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

      <RowsColumnsSection fileId={fileId} activeSheet={activeSheet} selection={selection} onCommitted={onCommitted} />
      <SortSection fileId={fileId} activeSheet={activeSheet} selection={selection} onCommitted={onCommitted} />
    </div>
  );
}

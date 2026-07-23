"use client";

import { useEffect, useState } from "react";

import { ChartPreview, type ChartPreviewData } from "@/components/ChartPreview";
import { useEngineAction } from "@/hooks/useEngineAction";
import { API_BASE_URL } from "@/lib/api";
import { parseRange, selectionToRangeRef, type RangeBounds, type SelectionRange } from "@/lib/range";
import { cellAt, toNumber } from "@/lib/selectionStats";
import type { ChartRequest, ChartResponse, ChartType, SheetSummary } from "@/lib/types";

type InsertTabProps = {
  fileId: string;
  activeSheet: string;
  sheet: SheetSummary;
  selection: SelectionRange;
  onApplied: (newFileId: string) => void;
};

function extractColumn(sheet: SheetSummary, bounds: RangeBounds, col: number) {
  const values = [];
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    values.push(cellAt(sheet, r, col));
  }
  return values;
}

function buildPreviewData(sheet: SheetSummary, request: ChartRequest): ChartPreviewData | null {
  if (request.chart_type === "scatter") {
    if (!request.x_range || !request.y_range) return null;
    const xBounds = parseRange(request.x_range);
    const yBounds = parseRange(request.y_range);
    if (!xBounds || !yBounds) return null;

    const xValues = extractColumn(sheet, xBounds, xBounds.minCol).map(toNumber).filter((v): v is number => v !== null);
    const yValues = extractColumn(sheet, yBounds, yBounds.minCol).map(toNumber).filter((v): v is number => v !== null);
    const n = Math.min(xValues.length, yValues.length);
    if (n === 0) return null;
    return { kind: "scatter", xValues: xValues.slice(0, n), yValues: yValues.slice(0, n) };
  }

  if (!request.data_range) return null;
  const dataBounds = parseRange(request.data_range);
  if (!dataBounds) return null;

  const dataStartRow = dataBounds.minRow === 1 ? 2 : dataBounds.minRow;
  const values = extractColumn(sheet, { ...dataBounds, minRow: dataStartRow }, dataBounds.minCol).map(
    (v) => toNumber(v) ?? 0
  );

  let categories: string[];
  if (request.categories_range) {
    const catBounds = parseRange(request.categories_range);
    categories = catBounds
      ? extractColumn(sheet, catBounds, catBounds.minCol).map((v) => (v === null ? "" : String(v)))
      : values.map((_, i) => `Row ${i + 1}`);
  } else {
    categories = values.map((_, i) => `Row ${i + 1}`);
  }

  const n = Math.min(values.length, categories.length);
  if (n === 0) return null;
  const trimmedValues = values.slice(0, n);
  const trimmedCategories = categories.slice(0, n);

  if (request.chart_type === "pie") return { kind: "pie", categories: trimmedCategories, values: trimmedValues };
  return { kind: "categorical", chartType: request.chart_type, categories: trimmedCategories, values: trimmedValues };
}

export function InsertTab({ fileId, activeSheet, sheet, selection, onApplied }: InsertTabProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [anchor, setAnchor] = useState("E2");
  const [title, setTitle] = useState("");

  const [dataRange, setDataRange] = useState("");
  const [categoriesRange, setCategoriesRange] = useState("");
  const [xRange, setXRange] = useState("");
  const [yRange, setYRange] = useState("");

  const [previewData, setPreviewData] = useState<ChartPreviewData | null>(null);

  const { isRunning, result, error, run } = useEngineAction<ChartRequest, ChartResponse>(
    `/workbook/${fileId}/chart`,
    onApplied
  );

  // Keep the data range in sync with the grid selection -- still hand-editable
  // afterward, and left untouched for "all" (a whole-sheet selection isn't a
  // well-defined single chart data column).
  useEffect(() => {
    const rangeRef = selectionToRangeRef(selection);
    if (rangeRef) setDataRange(rangeRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const isScatter = chartType === "scatter";
  const isReady = isScatter ? xRange.trim() !== "" && yRange.trim() !== "" : dataRange.trim() !== "";

  const buildRequest = (): ChartRequest => ({
    sheet_name: activeSheet,
    chart_type: chartType,
    anchor: anchor.trim() || undefined,
    title: title.trim() || undefined,
    data_range: isScatter ? undefined : dataRange.trim(),
    categories_range: isScatter || !categoriesRange.trim() ? undefined : categoriesRange.trim(),
    x_range: isScatter ? xRange.trim() : undefined,
    y_range: isScatter ? yRange.trim() : undefined,
  });

  const handleRun = async (commit: boolean) => {
    const request = buildRequest();
    const response = await run(request, commit);
    if (response) {
      setPreviewData(buildPreviewData(sheet, request));
    }
  };

  const downloadUrl = result?.new_file_id ? `${API_BASE_URL}/api/v1/workbook/${result.new_file_id}/export/xlsx` : null;

  return (
    <div className="p-4">
      <p className="text-sm text-neutral-500">
        Applies to sheet <span className="font-medium text-neutral-800">{activeSheet}</span>. The workbook viewer above
        can&apos;t show an embedded chart object at all, so the preview below is a local approximation drawn from the
        same preview rows (first 10) — the applied chart uses the full range and is a real, editable Excel chart.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block text-sm text-neutral-800">
          Chart type
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="mt-1 block rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
            <option value="pie">Pie</option>
            <option value="scatter">Scatter</option>
          </select>
        </label>
        <label className="block text-sm text-neutral-800">
          Anchor cell
          <input
            type="text"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            className="mt-1 block w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </label>
        <label className="block flex-1 text-sm text-neutral-800">
          Title (optional)
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Revenue by region"
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </label>
      </div>

      {isScatter ? (
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="block text-sm text-neutral-800">
            X range
            <input
              type="text"
              value={xRange}
              onChange={(e) => setXRange(e.target.value)}
              placeholder="e.g. A2:A4"
              className="mt-1 block w-32 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </label>
          <label className="block text-sm text-neutral-800">
            Y range
            <input
              type="text"
              value={yRange}
              onChange={(e) => setYRange(e.target.value)}
              placeholder="e.g. B2:B4"
              className="mt-1 block w-32 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </label>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="block text-sm text-neutral-800">
            Data range (from grid selection) {chartType === "pie" ? "(single column)" : ""}
            <input
              type="text"
              value={dataRange}
              onChange={(e) => setDataRange(e.target.value)}
              placeholder="e.g. B1:B4"
              className="mt-1 block w-32 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </label>
          <label className="block text-sm text-neutral-800">
            Categories range (optional)
            <input
              type="text"
              value={categoriesRange}
              onChange={(e) => setCategoriesRange(e.target.value)}
              placeholder="e.g. A2:A4"
              className="mt-1 block w-32 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isRunning || !isReady}
          onClick={() => handleRun(false)}
          className="rounded border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? "Working..." : "Preview"}
        </button>
        <button
          type="button"
          disabled={isRunning || !result}
          onClick={() => handleRun(true)}
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
        <p className="mt-4 text-sm text-neutral-700">
          {result.chart_type} chart anchored at <span className="font-medium text-neutral-900">{result.anchor}</span>
          {result.title ? <> — &ldquo;{result.title}&rdquo;</> : null}.
        </p>
      ) : null}

      {previewData ? (
        <div className="mt-4 rounded border border-excel-gridline bg-neutral-50 p-4">
          <ChartPreview data={previewData} />
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";

import { ChartPreview, type ChartPreviewData } from "@/components/ChartPreview";
import { parseRange, type RangeBounds } from "@/lib/range";
import type { CellValue, ChartRequest, ChartResponse, ChartType, SheetSummary } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ChartPanelProps = {
  fileId: string;
  activeSheet: string;
  sheet: SheetSummary;
  onApplied: (newFileId: string) => void;
};

function cellAt(sheet: SheetSummary, row: number, col: number): CellValue {
  if (row === 1) return sheet.headers[col - 1] ?? null;
  return sheet.preview_rows[row - 2]?.[col - 1] ?? null;
}

function extractColumn(sheet: SheetSummary, bounds: RangeBounds, col: number): CellValue[] {
  const values: CellValue[] = [];
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    values.push(cellAt(sheet, r, col));
  }
  return values;
}

function toNumber(value: CellValue): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

export function ChartPanel({ fileId, activeSheet, sheet, onApplied }: ChartPanelProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [anchor, setAnchor] = useState("E2");
  const [title, setTitle] = useState("");

  const [dataRange, setDataRange] = useState("");
  const [categoriesRange, setCategoriesRange] = useState("");
  const [xRange, setXRange] = useState("");
  const [yRange, setYRange] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChartResponse | null>(null);
  const [previewData, setPreviewData] = useState<ChartPreviewData | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

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

  const run = async (commit: boolean) => {
    setIsRunning(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const request = buildRequest();
      const url = `${API_BASE_URL}/api/v1/workbook/${fileId}/chart${commit ? "?commit=true" : ""}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Chart request failed.");
      }

      setResult(payload);
      setPreviewData(buildPreviewData(sheet, request));

      if (commit && payload.new_file_id) {
        setDownloadUrl(`${API_BASE_URL}/api/v1/workbook/${payload.new_file_id}/export/xlsx`);
        onApplied(payload.new_file_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
      <h2 className="text-xl font-semibold">Chart</h2>
      <p className="mt-1 text-sm text-slate-400">
        Applies to sheet <span className="font-medium text-slate-200">{activeSheet}</span>. The workbook viewer above
        can&apos;t show an embedded chart object at all, so the preview below is a local approximation drawn from the
        same preview rows (first 10) — the applied chart uses the full range and is a real, editable Excel chart.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block text-sm text-slate-200">
          Chart type
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
            <option value="pie">Pie</option>
            <option value="scatter">Scatter</option>
          </select>
        </label>
        <label className="block text-sm text-slate-200">
          Anchor cell
          <input
            type="text"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            className="mt-1 block w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
          />
        </label>
        <label className="block flex-1 text-sm text-slate-200">
          Title (optional)
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Revenue by region"
            className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
          />
        </label>
      </div>

      {isScatter ? (
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="block text-sm text-slate-200">
            X range
            <input
              type="text"
              value={xRange}
              onChange={(e) => setXRange(e.target.value)}
              placeholder="e.g. A2:A4"
              className="mt-1 block w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </label>
          <label className="block text-sm text-slate-200">
            Y range
            <input
              type="text"
              value={yRange}
              onChange={(e) => setYRange(e.target.value)}
              placeholder="e.g. B2:B4"
              className="mt-1 block w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </label>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="block text-sm text-slate-200">
            Data range {chartType === "pie" ? "(single column)" : ""}
            <input
              type="text"
              value={dataRange}
              onChange={(e) => setDataRange(e.target.value)}
              placeholder="e.g. B1:B4"
              className="mt-1 block w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </label>
          <label className="block text-sm text-slate-200">
            Categories range (optional)
            <input
              type="text"
              value={categoriesRange}
              onChange={(e) => setCategoriesRange(e.target.value)}
              placeholder="e.g. A2:A4"
              className="mt-1 block w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </label>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isRunning || !isReady}
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
        {downloadUrl ? (
          <a href={downloadUrl} className="text-sm font-medium text-cyan-400 underline hover:text-cyan-300">
            Download .xlsx
          </a>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}

      {result ? (
        <p className="mt-4 text-sm text-slate-300">
          {result.chart_type} chart anchored at <span className="font-medium text-slate-100">{result.anchor}</span>
          {result.title ? <> — &ldquo;{result.title}&rdquo;</> : null}.
        </p>
      ) : null}

      {previewData ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <ChartPreview data={previewData} />
        </div>
      ) : null}
    </div>
  );
}

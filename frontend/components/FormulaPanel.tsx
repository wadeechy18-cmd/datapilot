"use client";

import { useState } from "react";

import type { FormulaFunction, FormulaRequest, FormulaResponse } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Mode = "template" | "function";

type FormulaPanelProps = {
  fileId: string;
  activeSheet: string;
  onApplied: (newFileId: string) => void;
};

export function FormulaPanel({ fileId, activeSheet, onApplied }: FormulaPanelProps) {
  const [mode, setMode] = useState<Mode>("template");

  const [range, setRange] = useState("");
  const [formula, setFormula] = useState("");

  const [cell, setCell] = useState("");
  const [fn, setFn] = useState<FormulaFunction>("SUM");
  const [sourceRange, setSourceRange] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FormulaResponse | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const isReady =
    mode === "template" ? range.trim() !== "" && formula.trim().startsWith("=") : cell.trim() !== "" && sourceRange.trim() !== "";

  const buildRequest = (): FormulaRequest =>
    mode === "template"
      ? { sheet_name: activeSheet, range: range.trim(), formula: formula.trim() }
      : { sheet_name: activeSheet, cell: cell.trim(), function: fn, source_range: sourceRange.trim() };

  const run = async (commit: boolean) => {
    setIsRunning(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const url = `${API_BASE_URL}/api/v1/workbook/${fileId}/formula${commit ? "?commit=true" : ""}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest()),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Formula request failed.");
      }

      setResult(payload);
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
      <h2 className="text-xl font-semibold">Formulas</h2>
      <p className="mt-1 text-sm text-slate-400">
        Applies to sheet <span className="font-medium text-slate-200">{activeSheet}</span>. openpyxl writes formulas
        but can&apos;t calculate them, so the workbook viewer above will show these cells as blank until the file is
        opened in Excel — the computed result (for aggregate functions) is shown below instead.
      </p>

      <div className="mt-4 flex gap-4 text-sm text-slate-200">
        <label className="flex items-center gap-2">
          <input type="radio" name="formula-mode" checked={mode === "template"} onChange={() => setMode("template")} />
          Template (fill across a range)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="formula-mode" checked={mode === "function"} onChange={() => setMode("function")} />
          Aggregate function
        </label>
      </div>

      {mode === "template" ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-slate-200">
            Destination range
            <input
              type="text"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder="e.g. D2:D10"
              className="mt-1 block w-48 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </label>
          <label className="block text-sm text-slate-200">
            Formula ({"{row}"}/{"{col}"} are substituted per cell)
            <input
              type="text"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="e.g. =SUM(A{row}:C{row})"
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </label>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <label className="block text-sm text-slate-200">
              Destination cell
              <input
                type="text"
                value={cell}
                onChange={(e) => setCell(e.target.value)}
                placeholder="e.g. B1"
                className="mt-1 block w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
              />
            </label>
            <label className="block text-sm text-slate-200">
              Function
              <select
                value={fn}
                onChange={(e) => setFn(e.target.value as FormulaFunction)}
                className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
              >
                <option value="SUM">SUM</option>
                <option value="AVERAGE">AVERAGE</option>
                <option value="COUNT">COUNT</option>
                <option value="MIN">MIN</option>
                <option value="MAX">MAX</option>
              </select>
            </label>
            <label className="block text-sm text-slate-200">
              Source range
              <input
                type="text"
                value={sourceRange}
                onChange={(e) => setSourceRange(e.target.value)}
                placeholder="e.g. A1:A10"
                className="mt-1 block w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
              />
            </label>
          </div>
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
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200">
          <p>
            Wrote formula(s) to <span className="font-medium text-slate-100">{result.range_applied}</span> (
            {result.cells_written} cell{result.cells_written === 1 ? "" : "s"}).
          </p>
          {result.computed_value !== null ? (
            <p className="mt-1">
              Computed result: <span className="font-medium text-slate-100">{result.computed_value}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState, type CSSProperties } from "react";

import { parseRange } from "@/lib/range";
import type { FormattingRequest, FormattingResponse } from "@/lib/types";
import type { CellStyleOverride } from "@/components/WorkbookTable";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type TriState = "unset" | "on" | "off";
type TargetMode = "whole" | "header" | "range";

const NUMBER_FORMAT_PRESETS = [
  { label: "No change", value: "" },
  { label: "Number (0.00)", value: "0.00" },
  { label: "Percent (0.00%)", value: "0.00%" },
  { label: "Currency ($#,##0.00)", value: "$#,##0.00" },
  { label: "Date (yyyy-mm-dd)", value: "yyyy-mm-dd" },
  { label: "Custom...", value: "custom" },
];

const BORDER_WIDTH_PX: Record<string, number> = { thin: 1, medium: 2, thick: 3 };

type FormattingPanelProps = {
  fileId: string;
  activeSheet: string;
  onApplied: (newFileId: string) => void;
  onPreview: (override: CellStyleOverride | null) => void;
};

export function FormattingPanel({ fileId, activeSheet, onApplied, onPreview }: FormattingPanelProps) {
  const [targetMode, setTargetMode] = useState<TargetMode>("whole");
  const [rangeInput, setRangeInput] = useState("");

  const [bold, setBold] = useState<TriState>("unset");
  const [italic, setItalic] = useState<TriState>("unset");
  const [fontSize, setFontSize] = useState("");

  const [useFontColor, setUseFontColor] = useState(false);
  const [fontColor, setFontColor] = useState("#38bdf8");
  const [useFillColor, setUseFillColor] = useState(false);
  const [fillColor, setFillColor] = useState("#0f172a");

  const [numberFormatPreset, setNumberFormatPreset] = useState("");
  const [customNumberFormat, setCustomNumberFormat] = useState("");

  const [horizontalAlignment, setHorizontalAlignment] = useState("");
  const [verticalAlignment, setVerticalAlignment] = useState("");

  const [borderStyle, setBorderStyle] = useState("");
  const [borderColor, setBorderColor] = useState("#475569");

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FormattingResponse | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const numberFormat = numberFormatPreset === "custom" ? customNumberFormat : numberFormatPreset || undefined;

  const hasAnyStyle =
    bold !== "unset" ||
    italic !== "unset" ||
    fontSize.trim() !== "" ||
    useFontColor ||
    useFillColor ||
    Boolean(numberFormat) ||
    horizontalAlignment !== "" ||
    verticalAlignment !== "" ||
    borderStyle !== "";

  const targetIsValid = targetMode !== "range" || parseRange(rangeInput.trim()) !== null;

  const buildRequest = (): FormattingRequest => ({
    sheet_name: activeSheet,
    range: targetMode === "range" ? rangeInput.trim() : undefined,
    header_row: targetMode === "header",
    bold: bold === "unset" ? undefined : bold === "on",
    italic: italic === "unset" ? undefined : italic === "on",
    font_size: fontSize.trim() !== "" ? Number(fontSize) : undefined,
    font_color: useFontColor ? fontColor : undefined,
    fill_color: useFillColor ? fillColor : undefined,
    number_format: numberFormat || undefined,
    horizontal_alignment: (horizontalAlignment || undefined) as FormattingRequest["horizontal_alignment"],
    vertical_alignment: (verticalAlignment || undefined) as FormattingRequest["vertical_alignment"],
    border_style: (borderStyle || undefined) as FormattingRequest["border_style"],
    border_color: borderStyle ? borderColor : undefined,
  });

  const buildStyleOverride = (): CellStyleOverride | null => {
    const style: CSSProperties = {};
    if (bold !== "unset") style.fontWeight = bold === "on" ? 700 : 400;
    if (italic !== "unset") style.fontStyle = italic === "on" ? "italic" : "normal";
    if (fontSize.trim() !== "") style.fontSize = `${fontSize}px`;
    if (useFontColor) style.color = fontColor;
    if (useFillColor) style.backgroundColor = fillColor;
    if (horizontalAlignment) style.textAlign = horizontalAlignment as CSSProperties["textAlign"];
    if (verticalAlignment) style.verticalAlign = verticalAlignment as CSSProperties["verticalAlign"];
    if (borderStyle) {
      style.border = `${BORDER_WIDTH_PX[borderStyle] ?? 1}px solid ${borderColor}`;
    }

    if (targetMode === "header") return { target: { kind: "header" }, style };
    if (targetMode === "whole") return { target: { kind: "whole" }, style };
    const bounds = parseRange(rangeInput.trim());
    if (!bounds) return null;
    return { target: { kind: "range", bounds }, style };
  };

  const run = async (commit: boolean) => {
    setIsRunning(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const url = `${API_BASE_URL}/api/v1/workbook/${fileId}/format${commit ? "?commit=true" : ""}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest()),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Formatting request failed.");
      }

      setResult(payload);
      onPreview(buildStyleOverride());

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
      <h2 className="text-xl font-semibold">Format cells</h2>
      <p className="mt-1 text-sm text-slate-400">
        Applies to sheet <span className="font-medium text-slate-200">{activeSheet}</span>. Preview shows an
        approximation in the table above; apply to write real Excel formatting to a new file.
      </p>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">Target</p>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="radio" name="target" checked={targetMode === "whole"} onChange={() => setTargetMode("whole")} />
            Whole sheet
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="radio"
              name="target"
              checked={targetMode === "header"}
              onChange={() => setTargetMode("header")}
            />
            Header row only
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="radio" name="target" checked={targetMode === "range"} onChange={() => setTargetMode("range")} />
            Custom range
          </label>
          {targetMode === "range" ? (
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="e.g. A1:C10"
              className="ml-6 block w-40 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          ) : null}

          <p className="pt-2 text-sm font-medium text-slate-300">Font</p>
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <label>Bold</label>
            <select value={bold} onChange={(e) => setBold(e.target.value as TriState)} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-sm">
              <option value="unset">No change</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
            <label>Italic</label>
            <select value={italic} onChange={(e) => setItalic(e.target.value as TriState)} className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-sm">
              <option value="unset">No change</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            Size
            <input
              type="number"
              min={1}
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              placeholder="e.g. 14"
              className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={useFontColor} onChange={(e) => setUseFontColor(e.target.checked)} />
            Font color
            {useFontColor ? (
              <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} />
            ) : null}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={useFillColor} onChange={(e) => setUseFillColor(e.target.checked)} />
            Fill color
            {useFillColor ? (
              <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} />
            ) : null}
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">Number format</p>
          <select
            value={numberFormatPreset}
            onChange={(e) => setNumberFormatPreset(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
          >
            {NUMBER_FORMAT_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
          {numberFormatPreset === "custom" ? (
            <input
              type="text"
              value={customNumberFormat}
              onChange={(e) => setCustomNumberFormat(e.target.value)}
              placeholder="e.g. #,##0"
              className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            />
          ) : null}

          <p className="pt-2 text-sm font-medium text-slate-300">Alignment</p>
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <select
              value={horizontalAlignment}
              onChange={(e) => setHorizontalAlignment(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-sm"
            >
              <option value="">Horizontal: no change</option>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>
            <select
              value={verticalAlignment}
              onChange={(e) => setVerticalAlignment(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-sm"
            >
              <option value="">Vertical: no change</option>
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>

          <p className="pt-2 text-sm font-medium text-slate-300">Borders</p>
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <select
              value={borderStyle}
              onChange={(e) => setBorderStyle(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-sm"
            >
              <option value="">No change</option>
              <option value="thin">Thin</option>
              <option value="medium">Medium</option>
              <option value="thick">Thick</option>
            </select>
            {borderStyle ? <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} /> : null}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isRunning || !hasAnyStyle || !targetIsValid}
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
          <a
            href={downloadUrl}
            className="text-sm font-medium text-cyan-400 underline hover:text-cyan-300"
          >
            Download formatted .xlsx
          </a>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}

      {result ? (
        <p className="mt-4 text-sm text-slate-300">
          Applied to <span className="font-medium text-slate-100">{result.range_applied}</span> —{" "}
          {result.cells_formatted} cell(s) formatted.
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useState, type CSSProperties } from "react";

import { useEngineAction } from "@/hooks/useEngineAction";
import { API_BASE_URL } from "@/lib/api";
import { selectionBounds, selectionToRangeRef, type SelectionRange } from "@/lib/range";
import type { FormattingRequest, FormattingResponse } from "@/lib/types";
import type { CellStyleOverride } from "@/components/SheetGrid";

type TriState = "unset" | "on" | "off";

const NUMBER_FORMAT_PRESETS = [
  { label: "No change", value: "" },
  { label: "Number (0.00)", value: "0.00" },
  { label: "Percent (0.00%)", value: "0.00%" },
  { label: "Currency ($#,##0.00)", value: "$#,##0.00" },
  { label: "Date (yyyy-mm-dd)", value: "yyyy-mm-dd" },
  { label: "Custom...", value: "custom" },
];

const BORDER_WIDTH_PX: Record<string, number> = { thin: 1, medium: 2, thick: 3 };

type HomeTabProps = {
  fileId: string;
  activeSheet: string;
  selection: SelectionRange;
  onApplied: (newFileId: string) => void;
  onPreview: (override: CellStyleOverride | null) => void;
};

export function HomeTab({ fileId, activeSheet, selection, onApplied, onPreview }: HomeTabProps) {
  const [headerRowOnly, setHeaderRowOnly] = useState(false);

  const [bold, setBold] = useState<TriState>("unset");
  const [italic, setItalic] = useState<TriState>("unset");
  const [fontSize, setFontSize] = useState("");

  const [useFontColor, setUseFontColor] = useState(false);
  const [fontColor, setFontColor] = useState("#217346");
  const [useFillColor, setUseFillColor] = useState(false);
  const [fillColor, setFillColor] = useState("#ffff00");

  const [numberFormatPreset, setNumberFormatPreset] = useState("");
  const [customNumberFormat, setCustomNumberFormat] = useState("");

  const [horizontalAlignment, setHorizontalAlignment] = useState("");
  const [verticalAlignment, setVerticalAlignment] = useState("");

  const [borderStyle, setBorderStyle] = useState("");
  const [borderColor, setBorderColor] = useState("#000000");

  const { isRunning, result, error, run } = useEngineAction<FormattingRequest, FormattingResponse>(
    `/workbook/${fileId}/format`,
    onApplied
  );

  const selectionRangeRef = selection.kind === "all" ? null : selectionToRangeRef(selection);
  const targetDescription = headerRowOnly ? "header row" : selectionRangeRef ?? "whole sheet";

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

  const buildRequest = (): FormattingRequest => ({
    sheet_name: activeSheet,
    range: headerRowOnly ? undefined : selectionRangeRef ?? undefined,
    header_row: headerRowOnly,
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

    if (headerRowOnly) return { target: { kind: "header" }, style };
    const bounds = selectionBounds(selection);
    if (!bounds) return { target: { kind: "whole" }, style };
    return { target: { kind: "range", bounds }, style };
  };

  const handleRun = async (commit: boolean) => {
    const request = buildRequest();
    const response = await run(request, commit);
    if (response) {
      onPreview(buildStyleOverride());
    }
  };

  const downloadUrl = result?.new_file_id ? `${API_BASE_URL}/api/v1/workbook/${result.new_file_id}/export/xlsx` : null;

  return (
    <div className="p-4">
      <p className="text-sm text-neutral-500">
        Applies to <span className="font-medium text-neutral-800">{targetDescription}</span> on sheet{" "}
        <span className="font-medium text-neutral-800">{activeSheet}</span> — select cells in the grid above to
        change the target. Preview shows an approximation in the grid; apply to write real Excel formatting to a
        new file.
      </p>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input type="checkbox" checked={headerRowOnly} onChange={(e) => setHeaderRowOnly(e.target.checked)} />
            Header row only (ignores grid selection)
          </label>

          <p className="pt-2 text-sm font-medium text-neutral-700">Font</p>
          <div className="flex items-center gap-3 text-sm text-neutral-800">
            <label>Bold</label>
            <select value={bold} onChange={(e) => setBold(e.target.value as TriState)} className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-sm">
              <option value="unset">No change</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
            <label>Italic</label>
            <select value={italic} onChange={(e) => setItalic(e.target.value as TriState)} className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-sm">
              <option value="unset">No change</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            Size
            <input
              type="number"
              min={1}
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              placeholder="e.g. 14"
              className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input type="checkbox" checked={useFontColor} onChange={(e) => setUseFontColor(e.target.checked)} />
            Font color
            {useFontColor ? (
              <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} />
            ) : null}
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input type="checkbox" checked={useFillColor} onChange={(e) => setUseFillColor(e.target.checked)} />
            Fill color
            {useFillColor ? (
              <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} />
            ) : null}
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">Number format</p>
          <select
            value={numberFormatPreset}
            onChange={(e) => setNumberFormatPreset(e.target.value)}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
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
              className="block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          ) : null}

          <p className="pt-2 text-sm font-medium text-neutral-700">Alignment</p>
          <div className="flex items-center gap-3 text-sm text-neutral-800">
            <select
              value={horizontalAlignment}
              onChange={(e) => setHorizontalAlignment(e.target.value)}
              className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-sm"
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
              className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-sm"
            >
              <option value="">Vertical: no change</option>
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>

          <p className="pt-2 text-sm font-medium text-neutral-700">Borders</p>
          <div className="flex items-center gap-3 text-sm text-neutral-800">
            <select
              value={borderStyle}
              onChange={(e) => setBorderStyle(e.target.value)}
              className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-sm"
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isRunning || !hasAnyStyle}
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
            Download formatted .xlsx
          </a>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {result ? (
        <p className="mt-4 text-sm text-neutral-700">
          Applied to <span className="font-medium text-neutral-900">{result.range_applied}</span> —{" "}
          {result.cells_formatted} cell(s) formatted.
        </p>
      ) : null}
    </div>
  );
}

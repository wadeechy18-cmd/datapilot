"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

import { useEngineAction } from "@/hooks/useEngineAction";
import { cellRef, parseRange, type SelectionRange } from "@/lib/range";
import { cellAt } from "@/lib/selectionStats";
import type { FormulaRequest, FormulaResponse, SheetSummary } from "@/lib/types";

type FormulaBarProps = {
  fileId: string;
  activeSheet: string;
  sheet: SheetSummary;
  selection: SelectionRange;
  onSelectionChange: (selection: SelectionRange) => void;
  onApplied: (newFileId: string) => void;
};

export function FormulaBar({
  fileId,
  activeSheet,
  sheet,
  selection,
  onSelectionChange,
  onApplied,
}: FormulaBarProps) {
  const activeCell = selection.kind === "range" ? selection.focus : null;
  const activeCellRef = activeCell ? cellRef(activeCell) : "";

  const [nameBoxValue, setNameBoxValue] = useState(activeCellRef);
  const [fxValue, setFxValue] = useState("");
  const [rejection, setRejection] = useState<string | null>(null);

  const { isRunning, error, run } = useEngineAction<FormulaRequest, FormulaResponse>(
    `/workbook/${fileId}/formula`,
    onApplied
  );

  useEffect(() => {
    setNameBoxValue(activeCellRef);
    setRejection(null);
    if (activeCell) {
      const value = cellAt(sheet, activeCell.row, activeCell.col);
      setFxValue(value === null ? "" : String(value));
    } else {
      setFxValue("");
    }
    // Only re-sync when the active cell reference itself changes -- not on every
    // sheet re-render -- so a user's in-progress typing isn't clobbered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCellRef]);

  const handleNameBoxKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const bounds = parseRange(nameBoxValue.trim());
    if (!bounds) return;
    const coord = { row: bounds.minRow, col: bounds.minCol };
    onSelectionChange({ kind: "range", anchor: coord, focus: coord });
  };

  const handleFxKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    setRejection(null);

    if (!activeCell) {
      setRejection("Select a single cell first.");
      return;
    }
    if (!fxValue.trim().startsWith("=")) {
      setRejection("Formulas must start with '='.");
      return;
    }

    const request: FormulaRequest = {
      sheet_name: activeSheet,
      range: cellRef(activeCell),
      formula: fxValue.trim(),
    };
    const response = await run(request, true);
    if (response) {
      setFxValue("");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded border border-excel-gridline bg-white px-3 py-2">
      <input
        type="text"
        aria-label="Name box"
        value={nameBoxValue}
        onChange={(e) => setNameBoxValue(e.target.value)}
        onKeyDown={handleNameBoxKeyDown}
        className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-sm font-medium text-neutral-800"
      />
      <span className="text-sm italic text-neutral-400">fx</span>
      <input
        type="text"
        aria-label="Formula input"
        value={fxValue}
        onChange={(e) => setFxValue(e.target.value)}
        onKeyDown={handleFxKeyDown}
        disabled={isRunning}
        placeholder="Type a formula starting with = and press Enter to commit directly"
        className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
      />
      {rejection || error ? <span className="whitespace-nowrap text-xs text-red-600">{rejection ?? error}</span> : null}
    </div>
  );
}

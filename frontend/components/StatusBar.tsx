import { SheetTabs } from "@/components/SheetTabs";
import { computeSelectionStats } from "@/lib/selectionStats";
import type { SelectionRange } from "@/lib/range";
import type { SheetSummary } from "@/lib/types";

type StatusBarProps = {
  sheetNames: string[];
  activeSheet: string;
  onSelect: (sheetName: string) => void;
  sheet: SheetSummary;
  selection: SelectionRange;
};

export function StatusBar({ sheetNames, activeSheet, onSelect, sheet, selection }: StatusBarProps) {
  const stats = computeSelectionStats(sheet, selection);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-excel-gridline bg-neutral-50 px-4 py-2">
      <SheetTabs sheetNames={sheetNames} activeSheet={activeSheet} onSelect={onSelect} />
      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        {selection.kind === "all" ? (
          <span>Whole sheet selected</span>
        ) : stats ? (
          <>
            <span>Count: {stats.cellCount}</span>
            {stats.numericCount > 0 ? (
              <>
                <span>Numerical count: {stats.numericCount}</span>
                <span>Sum: {stats.sum}</span>
                <span>Average: {stats.average !== null ? stats.average.toFixed(2) : "—"}</span>
              </>
            ) : null}
          </>
        ) : null}
        <span className="text-neutral-400">|</span>
        <span>
          {sheet.row_count} row(s), {sheet.column_count} column(s)
        </span>
      </div>
    </div>
  );
}

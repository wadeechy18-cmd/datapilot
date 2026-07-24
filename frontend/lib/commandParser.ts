import { cellRef, selectionBounds, selectionToRangeRef, type SelectionRange } from "@/lib/range";
import type {
  ChartRequest,
  ChartType,
  CleaningRequest,
  FormattingRequest,
  FormulaFunction,
  FormulaRequest,
  RowColumnReference,
  RowColumnRequest,
  RowColumnTarget,
  SortRequest,
} from "@/lib/types";

type RunnableCommand = {
  kind: "clean" | "format" | "formula" | "chart" | "rows-columns" | "sort";
  description: string;
  path: "clean" | "format" | "formula" | "chart" | "rows-columns" | "sort";
  request: CleaningRequest | FormattingRequest | FormulaRequest | ChartRequest | RowColumnRequest | SortRequest;
};

export type ParsedCommand = RunnableCommand | { kind: "unsupported"; description: string } | { kind: "unrecognized" };

const COLOR_NAMES: Record<string, string> = {
  yellow: "#FFFF00",
  red: "#FF0000",
  green: "#00B050",
  blue: "#0070C0",
  orange: "#FFA500",
  gray: "#808080",
  grey: "#808080",
  purple: "#7030A0",
};

const FORMULA_FUNCTIONS: { pattern: RegExp; fn: FormulaFunction }[] = [
  { pattern: /\b(sum|total|add up)\b/i, fn: "SUM" },
  { pattern: /\b(average|avg|mean)\b/i, fn: "AVERAGE" },
  { pattern: /\bcount\b/i, fn: "COUNT" },
  { pattern: /\b(min|minimum|smallest|lowest)\b/i, fn: "MIN" },
  { pattern: /\b(max|maximum|largest|biggest|highest)\b/i, fn: "MAX" },
];

const CHART_TYPES: { pattern: RegExp; type: ChartType }[] = [
  { pattern: /\bbar chart\b/i, type: "bar" },
  { pattern: /\bline chart\b/i, type: "line" },
  { pattern: /\bpie chart\b/i, type: "pie" },
  { pattern: /\barea chart\b/i, type: "area" },
];

// Things people are likely to ask for that this rule-based bar recognizes but
// the backend genuinely can't do (or that already have a dedicated control) --
// answered honestly instead of falling through to "didn't understand".
const UNSUPPORTED_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /\bfreeze panes?\b/i, description: "Freeze panes isn't supported yet." },
  { pattern: /\bmerge cells?\b/i, description: "Merging cells isn't supported yet." },
  { pattern: /\bpivot tables?\b/i, description: "Pivot tables aren't supported yet." },
  { pattern: /\bconditional format/i, description: "Conditional formatting isn't supported yet." },
  { pattern: /\b(add|new|insert) (a |an )?sheet\b/i, description: "Adding a new sheet isn't supported yet." },
  { pattern: /\bundo\b/i, description: 'Use the "Undo" button (or Ctrl+Z) above the ribbon instead.' },
  { pattern: /\bredo\b/i, description: 'Use the "Redo" button (or Ctrl+Y) above the ribbon instead.' },
  { pattern: /\bscatter (chart|plot)\b/i, description: "Scatter charts need separate X and Y ranges — use the Insert tab for those." },
];

/** Rule-based (no AI) command bar: maps a handful of common typed phrases onto
 * the engine actions that already exist (Clean/Format/Formula/Chart), using the
 * current sheet + grid selection as the target. Not natural-language understanding
 * -- just keyword matching over a fixed vocabulary, so it fails loudly (distinct
 * "unsupported" vs "unrecognized" outcomes) rather than guessing. */
export function parseCommand(input: string, ctx: { sheetName: string; selection: SelectionRange }): ParsedCommand {
  const text = input.trim();
  if (!text) return { kind: "unrecognized" };

  for (const { pattern, description } of UNSUPPORTED_PATTERNS) {
    if (pattern.test(text)) return { kind: "unsupported", description };
  }

  const rangeRef = ctx.selection.kind === "all" ? null : selectionToRangeRef(ctx.selection);
  const wantsHeader = /\bheader\b/i.test(text);

  // --- Formatting: bold / italic / fill color ---
  const boldOff = /\b(unbold|remove bold|no bold)\b/i.test(text);
  const boldOn = !boldOff && /\bbold\b/i.test(text);
  const italicOff = /\b(unitalic|remove italic|no italic)\b/i.test(text);
  const italicOn = !italicOff && /\bitalic\b/i.test(text);
  const colorName = Object.keys(COLOR_NAMES).find((name) => new RegExp(`\\b${name}\\b`, "i").test(text));
  const wantsFill = Boolean(colorName) && /\b(fill|highlight|color|colour)\b/i.test(text);

  if (boldOn || boldOff || italicOn || italicOff || wantsFill) {
    if (!wantsHeader && !rangeRef) {
      return { kind: "unsupported", description: 'Select a range in the grid first (or say "header") before running a formatting command.' };
    }
    const request: FormattingRequest = {
      sheet_name: ctx.sheetName,
      header_row: wantsHeader,
      range: wantsHeader ? undefined : rangeRef ?? undefined,
      bold: boldOn ? true : boldOff ? false : undefined,
      italic: italicOn ? true : italicOff ? false : undefined,
      fill_color: wantsFill ? COLOR_NAMES[colorName as string] : undefined,
    };
    const actions = [
      boldOn ? "bold on" : boldOff ? "bold off" : null,
      italicOn ? "italic on" : italicOff ? "italic off" : null,
      wantsFill ? `${colorName} fill` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const target = wantsHeader ? "the header row" : rangeRef;
    return { kind: "format", path: "format", description: `Set ${actions} on ${target}`, request };
  }

  // --- Formula: AutoSum-style aggregate into the cell below the selection ---
  const fnMatch = FORMULA_FUNCTIONS.find((f) => f.pattern.test(text));
  if (fnMatch) {
    if (!rangeRef) {
      return { kind: "unsupported", description: "Select a range in the grid first, then ask for sum/average/count/min/max." };
    }
    const bounds = selectionBounds(ctx.selection);
    const destinationCell = bounds ? cellRef({ row: bounds.maxRow + 1, col: bounds.maxCol }) : null;
    if (!destinationCell) return { kind: "unrecognized" };
    const request: FormulaRequest = { sheet_name: ctx.sheetName, function: fnMatch.fn, source_range: rangeRef, cell: destinationCell };
    return { kind: "formula", path: "formula", description: `Write =${fnMatch.fn}(${rangeRef}) to ${destinationCell}`, request };
  }

  // --- Rows & Columns: insert / delete ---
  const mentionsRow = /\brows?\b/i.test(text);
  const mentionsColumn = /\bcolumns?\b/i.test(text);
  const wantsInsert = /\binsert\b/i.test(text) && (mentionsRow || mentionsColumn);
  const wantsDelete = /\bdelete\b/i.test(text) && (mentionsRow || mentionsColumn);

  if (wantsInsert) {
    const target: RowColumnTarget = mentionsRow ? "row" : "column";
    const bounds = selectionBounds(ctx.selection);
    if (!bounds) {
      return { kind: "unsupported", description: `Select a ${target} in the grid first, then ask to insert.` };
    }
    const wantsFarSide = /\b(below|right)\b/i.test(text);
    const reference: RowColumnReference =
      target === "row" ? (wantsFarSide ? "below" : "above") : wantsFarSide ? "right" : "left";
    const position =
      reference === "above" || reference === "left"
        ? target === "row"
          ? bounds.minRow
          : bounds.minCol
        : target === "row"
          ? bounds.maxRow
          : bounds.maxCol;
    const request: RowColumnRequest = { sheet_name: ctx.sheetName, action: "insert", target, position, reference };
    return { kind: "rows-columns", path: "rows-columns", description: `Insert a ${target} ${reference} the current selection`, request };
  }

  if (wantsDelete) {
    const target: RowColumnTarget = mentionsRow ? "row" : "column";
    const bounds = selectionBounds(ctx.selection);
    if (!bounds) {
      return { kind: "unsupported", description: `Select a ${target} in the grid first, then ask to delete.` };
    }
    const position = target === "row" ? bounds.minRow : bounds.minCol;
    const count = target === "row" ? bounds.maxRow - bounds.minRow + 1 : bounds.maxCol - bounds.minCol + 1;
    const request: RowColumnRequest = { sheet_name: ctx.sheetName, action: "delete", target, position, count };
    const description = count > 1 ? `Delete ${count} ${target}s at the current selection` : `Delete the ${target} at the current selection`;
    return { kind: "rows-columns", path: "rows-columns", description, request };
  }

  // --- Sort ---
  if (/\bsort\b/i.test(text)) {
    const columnMatch = /\bcolumn\s+([A-Za-z]+)\b/i.exec(text);
    if (!columnMatch) {
      return { kind: "unsupported", description: 'Say which column, e.g. "sort by column B" or "sort column B descending".' };
    }
    const column = columnMatch[1].toUpperCase();
    const descending = /\bdescend(ing)?\b|\bdesc\b/i.test(text);
    const request: SortRequest = { sheet_name: ctx.sheetName, column, ascending: !descending, has_header: true };
    return {
      kind: "sort",
      path: "sort",
      description: `Sort by column ${column} ${descending ? "descending" : "ascending"}`,
      request,
    };
  }

  // --- Cleaning: whole-sheet operations, selection-independent ---
  const trim = /\btrim\b/i.test(text);
  const dedupe = /\b(dedupe|deduplicate|drop duplicate|remove duplicate)/i.test(text);
  const dropEmptyRows = /\b(drop|remove) empty rows\b/i.test(text);
  const dropEmptyCols = /\b(drop|remove) empty columns\b/i.test(text);
  const quickClean = !trim && !dedupe && !dropEmptyRows && !dropEmptyCols && /\bclean\b/i.test(text);

  if (trim || dedupe || dropEmptyRows || dropEmptyCols || quickClean) {
    const request: CleaningRequest = {
      sheet_name: ctx.sheetName,
      trim_whitespace: trim || quickClean,
      drop_empty_rows: dropEmptyRows || quickClean,
      drop_empty_columns: dropEmptyCols || quickClean,
      drop_duplicate_rows: dedupe,
      drop_rows_with_nulls: false,
      fill_nulls: null,
    };
    const description = quickClean
      ? "Trim whitespace and drop empty rows/columns"
      : [trim && "trim whitespace", dedupe && "drop duplicate rows", dropEmptyRows && "drop empty rows", dropEmptyCols && "drop empty columns"]
          .filter(Boolean)
          .join(", ");
    return { kind: "clean", path: "clean", description, request };
  }

  // --- Chart ---
  const chartMatch = CHART_TYPES.find((c) => c.pattern.test(text));
  if (chartMatch) {
    if (!rangeRef) return { kind: "unsupported", description: "Select a data range in the grid first, then ask for a chart." };
    const request: ChartRequest = { sheet_name: ctx.sheetName, chart_type: chartMatch.type, data_range: rangeRef };
    return { kind: "chart", path: "chart", description: `Insert a ${chartMatch.type} chart from ${rangeRef}`, request };
  }

  return { kind: "unrecognized" };
}

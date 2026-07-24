export type CellValue = string | number | boolean | null;

export type SheetSummary = {
  name: string;
  row_count: number;
  column_count: number;
  headers: CellValue[];
  preview_rows: CellValue[][];
  non_empty_cells: number;
  empty_cells: number;
  numeric_cells: number;
  text_cells: number;
};

export type WorkbookSummary = {
  file_id: string;
  sheet_count: number;
  sheet_names: string[];
  sheets: SheetSummary[];
};

export type FillNullsStrategy = "zero" | "mean" | "mode" | "placeholder";

export type FillNullsRequest = {
  strategy: FillNullsStrategy;
  placeholder?: CellValue;
};

export type CleaningRequest = {
  sheet_name?: string | null;
  trim_whitespace: boolean;
  drop_empty_rows: boolean;
  drop_empty_columns: boolean;
  drop_duplicate_rows: boolean;
  drop_rows_with_nulls: boolean;
  fill_nulls?: FillNullsRequest | null;
};

export type SheetCleaningSummary = {
  name: string;
  original_row_count: number;
  cleaned_row_count: number;
  original_column_count: number;
  cleaned_column_count: number;
  rows_removed: number;
  columns_removed: number;
  cells_trimmed: number;
  nulls_filled: number;
  headers: CellValue[];
  preview_rows: CellValue[][];
};

export type CleaningResponse = {
  file_id: string;
  new_file_id: string | null;
  sheets: SheetCleaningSummary[];
};

export type FormattingRequest = {
  sheet_name: string;
  range?: string | null;
  header_row?: boolean;
  bold?: boolean | null;
  italic?: boolean | null;
  font_size?: number | null;
  font_color?: string | null;
  fill_color?: string | null;
  number_format?: string | null;
  horizontal_alignment?: "left" | "center" | "right" | "justify" | null;
  vertical_alignment?: "top" | "center" | "bottom" | null;
  border_style?: "thin" | "medium" | "thick" | null;
  border_color?: string | null;
};

export type FormattingResponse = {
  file_id: string;
  new_file_id: string | null;
  sheet_name: string;
  range_applied: string;
  cells_formatted: number;
};

export type FormulaFunction = "SUM" | "AVERAGE" | "COUNT" | "MIN" | "MAX";

export type FormulaRequest = {
  sheet_name: string;
  range?: string;
  formula?: string;
  cell?: string;
  function?: FormulaFunction;
  source_range?: string;
};

export type FormulaResponse = {
  file_id: string;
  new_file_id: string | null;
  sheet_name: string;
  range_applied: string;
  cells_written: number;
  computed_value: number | null;
};

export type ChartType = "bar" | "line" | "pie" | "area" | "scatter";

export type ChartRequest = {
  sheet_name: string;
  chart_type: ChartType;
  anchor?: string;
  title?: string;
  data_range?: string;
  categories_range?: string;
  x_range?: string;
  y_range?: string;
};

export type ChartResponse = {
  file_id: string;
  new_file_id: string | null;
  sheet_name: string;
  chart_type: string;
  anchor: string;
  title: string | null;
};

export type RowColumnAction = "insert" | "delete";
export type RowColumnTarget = "row" | "column";
export type RowColumnReference = "above" | "below" | "left" | "right";

export type RowColumnRequest = {
  sheet_name: string;
  action: RowColumnAction;
  target: RowColumnTarget;
  position: number;
  reference?: RowColumnReference;
  count?: number;
};

export type RowColumnResponse = {
  file_id: string;
  new_file_id: string | null;
  sheet_name: string;
  action: RowColumnAction;
  target: RowColumnTarget;
  position: number;
  count: number;
  new_row_count: number;
  new_column_count: number;
};

export type SortRequest = {
  sheet_name: string;
  column: string;
  ascending?: boolean;
  has_header?: boolean;
};

export type SortResponse = {
  file_id: string;
  new_file_id: string | null;
  sheet_name: string;
  column: string;
  ascending: boolean;
  has_header: boolean;
  row_count: number;
};

export type AISummaryRequest = {
  sheet_name?: string;
};

export type AISummaryResponse = {
  file_id: string;
  sheet_name: string;
  summary: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  sheet_name: string;
  selection?: string | null;
  messages: ChatMessage[];
};

export type ChatResponse = {
  reply: string;
  new_file_id: string | null;
  engine: string | null;
};

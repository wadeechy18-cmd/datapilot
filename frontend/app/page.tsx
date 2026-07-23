"use client";

import { FormEvent, useEffect, useState } from "react";

import { FormulaBar } from "@/components/FormulaBar";
import { Ribbon } from "@/components/ribbon/Ribbon";
import { SheetGrid, type CellStyleOverride } from "@/components/SheetGrid";
import { StatusBar } from "@/components/StatusBar";
import { UploadForm } from "@/components/UploadForm";
import { apiFetch } from "@/lib/api";
import { clampSelection, type SelectionRange } from "@/lib/range";
import type { WorkbookSummary } from "@/lib/types";

type HealthState = "checking" | "ok" | "error";

const A1_SELECTION: SelectionRange = { kind: "range", anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } };

export default function Home() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookSummary | null>(null);
  const [activeSheet, setActiveSheetState] = useState<string | null>(null);
  const [styleOverride, setStyleOverride] = useState<CellStyleOverride | null>(null);
  const [selection, setSelection] = useState<SelectionRange>(A1_SELECTION);

  const setActiveSheet = (sheetName: string) => {
    setStyleOverride(null);
    setSelection(A1_SELECTION);
    setActiveSheetState(sheetName);
  };

  useEffect(() => {
    apiFetch("/health")
      .then(() => setHealth("ok"))
      .catch(() => setHealth("error"));
  }, []);

  const loadWorkbook = async (fileId: string, opts: { resetSelection: boolean }) => {
    const workbookPayload = await apiFetch<WorkbookSummary>(`/workbook/${fileId}`);
    setWorkbook(workbookPayload);
    setStyleOverride(null);

    let nextSheetName = "";
    setActiveSheetState((current: string | null) => {
      nextSheetName =
        current && workbookPayload.sheet_names.includes(current) ? current : workbookPayload.sheet_names[0] ?? "";
      return nextSheetName || null;
    });

    const nextSheet = workbookPayload.sheets.find((s) => s.name === nextSheetName);
    if (opts.resetSelection || !nextSheet) {
      setSelection(A1_SELECTION);
    } else {
      setSelection((current) => clampSelection(current, 1 + nextSheet.preview_rows.length, nextSheet.headers.length));
    }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const uploadPayload = await apiFetch<{ file_id: string }>("/upload", {
        method: "POST",
        body: formData,
      });
      setSelectedFile(null);
      await loadWorkbook(uploadPayload.file_id, { resetSelection: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEngineCommitted = (newFileId: string) => {
    setError(null);
    loadWorkbook(newFileId, { resetSelection: false }).catch((err) => {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    });
  };

  const currentSheet = workbook?.sheets.find((sheet) => sheet.name === activeSheet) ?? null;

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-neutral-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded border border-excel-gridline bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-excel-green">ExcelAI</p>
          <h1 className="mt-3 text-4xl font-semibold text-neutral-900">Upload an Excel workbook</h1>
          <p className="mt-3 max-w-2xl text-neutral-500">
            Upload an .xlsx file and work with it like a real spreadsheet, backed by the FastAPI engine.
          </p>
          <div className="mt-6 inline-flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 text-sm">
            Backend status: {" "}
            <span className={health === "ok" ? "ml-2 font-medium text-excel-green" : "ml-2 font-medium text-red-600"}>
              {health}
            </span>
          </div>
        </section>

        {error ? (
          <p className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {!workbook ? (
          <section className="rounded border border-excel-gridline bg-white p-6 shadow-sm">
            <UploadForm
              selectedFile={selectedFile}
              isUploading={isUploading}
              onFileChange={setSelectedFile}
              onSubmit={handleUpload}
            />
          </section>
        ) : null}

        {workbook && activeSheet && currentSheet ? (
          <>
            <section className="rounded border border-excel-gridline bg-white p-6 shadow-sm">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold text-neutral-900">Workbook</h2>
                <p className="break-all font-mono text-xs text-neutral-500">{workbook.file_id}</p>
              </div>
              <div className="mt-4 space-y-4">
                <StatusBar
                  sheetNames={workbook.sheet_names}
                  activeSheet={activeSheet}
                  onSelect={setActiveSheet}
                  sheet={currentSheet}
                  selection={selection}
                />
                <FormulaBar
                  fileId={workbook.file_id}
                  activeSheet={activeSheet}
                  sheet={currentSheet}
                  selection={selection}
                  onSelectionChange={setSelection}
                  onApplied={handleEngineCommitted}
                />
                <SheetGrid
                  sheet={currentSheet}
                  selection={selection}
                  onSelectionChange={setSelection}
                  styleOverride={styleOverride}
                />
              </div>
            </section>

            <Ribbon
              fileId={workbook.file_id}
              sheetNames={workbook.sheet_names}
              activeSheet={activeSheet}
              sheet={currentSheet}
              selection={selection}
              onEngineCommitted={handleEngineCommitted}
              onFormattingPreview={setStyleOverride}
              selectedFile={selectedFile}
              isUploading={isUploading}
              onFileChange={setSelectedFile}
              onUpload={handleUpload}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

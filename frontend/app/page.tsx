"use client";

import { FormEvent, useEffect, useState } from "react";

import { ChartPanel } from "@/components/ChartPanel";
import { CleaningPanel } from "@/components/CleaningPanel";
import { FormattingPanel } from "@/components/FormattingPanel";
import { FormulaPanel } from "@/components/FormulaPanel";
import { SheetTabs } from "@/components/SheetTabs";
import { WorkbookTable, type CellStyleOverride } from "@/components/WorkbookTable";
import type { WorkbookSummary } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type HealthState = "checking" | "ok" | "error";

export default function Home() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookSummary | null>(null);
  const [activeSheet, setActiveSheetState] = useState<string | null>(null);
  const [styleOverride, setStyleOverride] = useState<CellStyleOverride | null>(null);

  const setActiveSheet = (sheetName: string) => {
    setStyleOverride(null);
    setActiveSheetState(sheetName);
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/health`)
      .then((res) => (res.ok ? setHealth("ok") : setHealth("error")))
      .catch(() => setHealth("error"));
  }, []);

  const loadWorkbook = async (fileId: string) => {
    const workbookResponse = await fetch(`${API_BASE_URL}/api/v1/workbook/${fileId}`);
    const workbookPayload = await workbookResponse.json();
    if (!workbookResponse.ok) {
      throw new Error(workbookPayload.detail ?? "Could not read workbook details.");
    }

    setWorkbook(workbookPayload);
    setStyleOverride(null);
    setActiveSheetState((current: string | null) =>
      current && workbookPayload.sheet_names.includes(current) ? current : workbookPayload.sheet_names[0] ?? null
    );
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setWorkbook(null);
    setActiveSheetState(null);
    setStyleOverride(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/upload`, {
        method: "POST",
        body: formData,
      });

      const uploadPayload = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadPayload.detail ?? "Upload failed.");
      }

      await loadWorkbook(uploadPayload.file_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEngineCommitted = (newFileId: string) => {
    setError(null);
    loadWorkbook(newFileId).catch((err) => {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    });
  };

  const currentSheet = workbook?.sheets.find((sheet) => sheet.name === activeSheet) ?? null;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">ExcelAI</p>
          <h1 className="mt-3 text-4xl font-semibold">Upload an Excel workbook</h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Upload an .xlsx file and view its sheets as real tables, backed by the FastAPI reader endpoint.
          </p>
          <div className="mt-6 inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm">
            Backend status: {" "}
            <span className={health === "ok" ? "ml-2 font-medium text-emerald-400" : "ml-2 font-medium text-rose-400"}>
              {health}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="workbook-file">
                Choose an .xlsx workbook
              </label>
              <input
                id="workbook-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isUploading ? "Uploading..." : "Upload and view"}
            </button>
          </form>
          {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <h2 className="text-xl font-semibold">Workbook</h2>
          {workbook && activeSheet ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">File ID</p>
                <p className="mt-1 break-all font-mono text-sm text-slate-200">{workbook.file_id}</p>
              </div>

              <SheetTabs sheetNames={workbook.sheet_names} activeSheet={activeSheet} onSelect={setActiveSheet} />

              {currentSheet ? <WorkbookTable sheet={currentSheet} styleOverride={styleOverride} /> : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Upload a workbook to see its sheets as real tables here.</p>
          )}
        </section>

        {workbook && activeSheet ? (
          <CleaningPanel
            fileId={workbook.file_id}
            sheetNames={workbook.sheet_names}
            activeSheet={activeSheet}
            onCommitted={handleEngineCommitted}
          />
        ) : null}

        {workbook && activeSheet ? (
          <FormattingPanel
            fileId={workbook.file_id}
            activeSheet={activeSheet}
            onApplied={handleEngineCommitted}
            onPreview={setStyleOverride}
          />
        ) : null}

        {workbook && activeSheet ? (
          <FormulaPanel fileId={workbook.file_id} activeSheet={activeSheet} onApplied={handleEngineCommitted} />
        ) : null}

        {workbook && activeSheet && currentSheet ? (
          <ChartPanel
            fileId={workbook.file_id}
            activeSheet={activeSheet}
            sheet={currentSheet}
            onApplied={handleEngineCommitted}
          />
        ) : null}
      </div>
    </main>
  );
}

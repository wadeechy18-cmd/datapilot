"use client";

import { FormEvent, useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type HealthState = "checking" | "ok" | "error";

type SheetSummary = {
  name: string;
  row_count: number;
  column_count: number;
  headers: Array<string | number | boolean | null>;
  preview_rows: Array<Array<string | number | boolean | null>>;
  non_empty_cells: number;
  empty_cells: number;
  numeric_cells: number;
  text_cells: number;
};

type WorkbookSummary = {
  file_id: string;
  sheet_count: number;
  sheet_names: string[];
  sheets: SheetSummary[];
};

export default function Home() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookSummary | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/health`)
      .then((res) => (res.ok ? setHealth("ok") : setHealth("error")))
      .catch(() => setHealth("error"));
  }, []);

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setWorkbook(null);

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

      const workbookResponse = await fetch(`${API_BASE_URL}/api/v1/workbook/${uploadPayload.file_id}/analysis`);
      const workbookPayload = await workbookResponse.json();
      if (!workbookResponse.ok) {
        throw new Error(workbookPayload.detail ?? "Could not read workbook details.");
      }

      setWorkbook(workbookPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">ExcelAI</p>
          <h1 className="mt-3 text-4xl font-semibold">Upload an Excel workbook</h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            This foundation screen uploads an .xlsx file to the FastAPI backend and shows the workbook structure returned by the reader.
          </p>
          <div className="mt-6 inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm">
            Backend status: {" "}
            <span className={health === "ok" ? "ml-2 font-medium text-emerald-400" : "ml-2 font-medium text-rose-400"}>
              {health}
            </span>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={handleUpload} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
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
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isUploading ? "Uploading..." : "Upload and inspect"}
            </button>
            {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
          </form>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
            <h2 className="text-xl font-semibold">Workbook preview</h2>
            {workbook ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">File ID</p>
                  <p className="mt-1 break-all font-mono text-sm text-slate-200">{workbook.file_id}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Sheets</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {workbook.sheets.map((sheet) => (
                      <li key={sheet.name} className="rounded bg-slate-900 px-3 py-2">
                        <span className="font-medium">{sheet.name}</span> — {sheet.row_count} rows, {sheet.column_count} columns
                      </li>
                    ))}
                  </ul>
                </div>
                {workbook.sheets.map((sheet) => (
                  <div key={sheet.name} className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
                    <h3 className="font-medium text-slate-100">{sheet.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">Headers: {sheet.headers.join(", ") || "(none)"}</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <div className="rounded bg-slate-900 px-3 py-2">Non-empty cells: {sheet.non_empty_cells}</div>
                      <div className="rounded bg-slate-900 px-3 py-2">Empty cells: {sheet.empty_cells}</div>
                      <div className="rounded bg-slate-900 px-3 py-2">Numeric cells: {sheet.numeric_cells}</div>
                      <div className="rounded bg-slate-900 px-3 py-2">Text cells: {sheet.text_cells}</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {sheet.preview_rows.map((row, index) => (
                        <div key={`${sheet.name}-${index}`} className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200">
                          {row.join(", ")}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Upload a workbook to see its sheets, headers, and preview rows here.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

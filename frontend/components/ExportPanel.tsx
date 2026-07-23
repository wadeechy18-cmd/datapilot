"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ExportPanelProps = {
  fileId: string;
  sheetNames: string[];
  activeSheet: string;
};

export function ExportPanel({ fileId, sheetNames, activeSheet }: ExportPanelProps) {
  const [csvSheet, setCsvSheet] = useState(activeSheet);

  useEffect(() => {
    setCsvSheet((current) => (sheetNames.includes(current) ? current : sheetNames[0] ?? current));
  }, [sheetNames]);

  const xlsxUrl = `${API_BASE_URL}/api/v1/workbook/${fileId}/export/xlsx`;
  const csvUrl = `${API_BASE_URL}/api/v1/workbook/${fileId}/export/csv?sheet_name=${encodeURIComponent(csvSheet)}`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
      <h2 className="text-xl font-semibold">Export</h2>
      <p className="mt-1 text-sm text-slate-400">
        Download the current workbook as a real .xlsx file, or export a single sheet&apos;s data as flat CSV.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <a
          href={xlsxUrl}
          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Download workbook (.xlsx)
        </a>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-200">
            Sheet
            <select
              value={csvSheet}
              onChange={(e) => setCsvSheet(e.target.value)}
              className="ml-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
            >
              {sheetNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <a
            href={csvUrl}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
          >
            Download sheet as CSV
          </a>
        </div>
      </div>
    </div>
  );
}

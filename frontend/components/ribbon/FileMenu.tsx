"use client";

import { useEffect, useState, type FormEvent } from "react";

import { UploadForm } from "@/components/UploadForm";
import { API_BASE_URL } from "@/lib/api";

type FileMenuProps = {
  fileId: string;
  sheetNames: string[];
  activeSheet: string;
  selectedFile: File | null;
  isUploading: boolean;
  onFileChange: (file: File | null) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
};

export function FileMenu({
  fileId,
  sheetNames,
  activeSheet,
  selectedFile,
  isUploading,
  onFileChange,
  onUpload,
}: FileMenuProps) {
  const [csvSheet, setCsvSheet] = useState(activeSheet);

  useEffect(() => {
    setCsvSheet((current) => (sheetNames.includes(current) ? current : sheetNames[0] ?? current));
  }, [sheetNames]);

  const xlsxUrl = `${API_BASE_URL}/api/v1/workbook/${fileId}/export/xlsx`;
  const csvUrl = `${API_BASE_URL}/api/v1/workbook/${fileId}/export/csv?sheet_name=${encodeURIComponent(csvSheet)}`;

  return (
    <div className="space-y-6 p-4">
      <div>
        <p className="text-sm font-medium text-neutral-700">Current file</p>
        <p className="mt-1 break-all font-mono text-sm text-neutral-800">{fileId}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-700">Export</p>
        <div className="mt-2 flex flex-wrap items-center gap-6">
          <a
            href={xlsxUrl}
            className="rounded bg-excel-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-excel-greenDark"
          >
            Download workbook (.xlsx)
          </a>

          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-800">
              Sheet
              <select
                value={csvSheet}
                onChange={(e) => setCsvSheet(e.target.value)}
                className="ml-2 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
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
              className="rounded border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-200"
            >
              Download sheet as CSV
            </a>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-700">Open a different workbook</p>
        <div className="mt-2">
          <UploadForm
            selectedFile={selectedFile}
            isUploading={isUploading}
            onFileChange={onFileChange}
            onSubmit={onUpload}
          />
        </div>
      </div>
    </div>
  );
}

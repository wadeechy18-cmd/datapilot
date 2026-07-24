"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api";
import type { AISummaryRequest, AISummaryResponse } from "@/lib/types";

type AITabProps = {
  fileId: string;
  activeSheet: string;
};

export function AITab({ fileId, activeSheet }: AITabProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizedSheet, setSummarizedSheet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async () => {
    setIsRunning(true);
    setError(null);
    setSummary(null);
    try {
      const request: AISummaryRequest = { sheet_name: activeSheet };
      const response = await apiFetch<AISummaryResponse>(`/workbook/${fileId}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      setSummary(response.summary);
      setSummarizedSheet(response.sheet_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4">
      <p className="text-sm text-neutral-500">
        Asks an AI model for a short summary of sheet{" "}
        <span className="font-medium text-neutral-800">{activeSheet}</span>. Only column-level statistics (types,
        null/unique counts, min/max/mean) are sent to the AI provider — never your actual cell data.
      </p>

      <div className="mt-4">
        <button
          type="button"
          disabled={isRunning}
          onClick={handleSummarize}
          className="rounded bg-excel-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-excel-greenDark disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {isRunning ? "Summarizing..." : "Summarize this sheet"}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {summary ? (
        <div className="mt-4 rounded border border-excel-gridline bg-neutral-50 p-4 text-sm text-neutral-800">
          <p className="font-medium text-neutral-900">Summary of {summarizedSheet}</p>
          <p className="mt-2 whitespace-pre-wrap">{summary}</p>
        </div>
      ) : null}
    </div>
  );
}

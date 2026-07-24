"use client";

import { useState, type KeyboardEvent } from "react";

import { apiFetch } from "@/lib/api";
import { parseCommand } from "@/lib/commandParser";
import type { SelectionRange } from "@/lib/range";

type CommandBarProps = {
  fileId: string;
  activeSheet: string;
  selection: SelectionRange;
  onApplied: (newFileId: string) => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const EXAMPLES = 'e.g. "bold the header", "sum this range", "trim whitespace", "remove duplicate rows", "bar chart from this range"';

export function CommandBar({ fileId, activeSheet, selection, onApplied }: CommandBarProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const text = value.trim();
    if (!text) return;

    const parsed = parseCommand(text, { sheetName: activeSheet, selection });

    if (parsed.kind === "unrecognized") {
      setStatus({ kind: "error", message: `Didn't recognize that. Try ${EXAMPLES}.` });
      return;
    }
    if (parsed.kind === "unsupported") {
      setStatus({ kind: "error", message: parsed.description });
      return;
    }

    setStatus({ kind: "running" });
    try {
      const payload = await apiFetch<{ new_file_id: string | null }>(`/workbook/${fileId}/${parsed.path}?commit=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.request),
      });
      if (payload.new_file_id) {
        onApplied(payload.new_file_id);
      }
      setStatus({ kind: "done", message: `Done: ${parsed.description}.` });
      setValue("");
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Unexpected error." });
    }
  };

  return (
    <div className="rounded border border-excel-gridline bg-white px-3 py-2">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-sm text-neutral-400">
          ⌘
        </span>
        <input
          type="text"
          aria-label="Command bar"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (status.kind !== "idle" && status.kind !== "running") setStatus({ kind: "idle" });
          }}
          onKeyDown={handleKeyDown}
          disabled={status.kind === "running"}
          placeholder={`Tell it what you want, then press Enter — ${EXAMPLES}`}
          className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
        {status.kind === "running" ? <span className="whitespace-nowrap text-xs text-neutral-500">Working…</span> : null}
      </div>
      {status.kind === "done" ? <p className="mt-2 text-xs text-excel-green">{status.message}</p> : null}
      {status.kind === "error" ? <p className="mt-2 text-xs text-red-600">{status.message}</p> : null}
    </div>
  );
}

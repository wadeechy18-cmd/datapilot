import { useState } from "react";

import { apiFetch } from "@/lib/api";

type CommittableResponse = { new_file_id: string | null };

/** Shared preview/commit state machine for the four write engines (Clean/Format/
 * Formula/Chart): POST without commit previews, POST with commit=true writes the
 * result to a new file_id and calls onCommitted. */
export function useEngineAction<TReq, TRes extends CommittableResponse>(
  path: string,
  onCommitted: (newFileId: string) => void
) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (req: TReq, commit: boolean): Promise<TRes | null> => {
    setIsRunning(true);
    setError(null);
    if (!commit) setResult(null);

    try {
      const payload = await apiFetch<TRes>(`${path}${commit ? "?commit=true" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      setResult(payload);
      if (commit && payload.new_file_id) {
        onCommitted(payload.new_file_id);
      }
      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      return null;
    } finally {
      setIsRunning(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { isRunning, result, error, run, reset };
}

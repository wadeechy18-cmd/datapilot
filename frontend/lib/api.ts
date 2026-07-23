export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Fetches JSON from the ExcelAI API (paths are relative to /api/v1) and throws with the
 * backend's own error detail on a non-2xx response. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail ?? "Request failed.");
  }
  return payload as T;
}

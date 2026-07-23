import type { FormEvent } from "react";

type UploadFormProps = {
  selectedFile: File | null;
  isUploading: boolean;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
};

export function UploadForm({ selectedFile, isUploading, onFileChange, onSubmit, submitLabel }: UploadFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
      <div className="flex-1">
        <label className="mb-2 block text-sm font-medium text-neutral-700" htmlFor="workbook-file">
          Choose an .xlsx workbook
        </label>
        <input
          id="workbook-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          className="block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={!selectedFile || isUploading}
        className="rounded bg-excel-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-excel-greenDark disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
      >
        {isUploading ? "Uploading..." : submitLabel ?? "Upload and view"}
      </button>
    </form>
  );
}

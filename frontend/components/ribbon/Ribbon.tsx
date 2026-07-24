"use client";

import { useState, type FormEvent } from "react";

import { DataTab } from "@/components/ribbon/DataTab";
import { FileMenu } from "@/components/ribbon/FileMenu";
import { FormulasTab } from "@/components/ribbon/FormulasTab";
import { HomeTab } from "@/components/ribbon/HomeTab";
import { InsertTab } from "@/components/ribbon/InsertTab";
import type { CellStyleOverride } from "@/components/SheetGrid";
import type { SelectionRange } from "@/lib/range";
import type { SheetSummary } from "@/lib/types";

type RibbonTabId = "file" | "home" | "insert" | "formulas" | "data";

const TABS: { id: RibbonTabId; label: string }[] = [
  { id: "file", label: "File" },
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "formulas", label: "Formulas" },
  { id: "data", label: "Data" },
];

type RibbonProps = {
  fileId: string;
  sheetNames: string[];
  activeSheet: string;
  sheet: SheetSummary;
  selection: SelectionRange;
  onEngineCommitted: (newFileId: string) => void;
  onFormattingPreview: (override: CellStyleOverride | null) => void;
  selectedFile: File | null;
  isUploading: boolean;
  onFileChange: (file: File | null) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export function Ribbon({
  fileId,
  sheetNames,
  activeSheet,
  sheet,
  selection,
  onEngineCommitted,
  onFormattingPreview,
  selectedFile,
  isUploading,
  onFileChange,
  onUpload,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: RibbonProps) {
  const [activeTab, setActiveTab] = useState<RibbonTabId>("home");

  return (
    <div className="rounded border border-excel-gridline bg-white shadow-sm">
      <div className="flex items-center gap-1 border-b border-excel-gridline bg-neutral-50 px-2 py-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="rounded px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          className="rounded px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
        >
          ↷ Redo
        </button>
      </div>
      <div className="flex border-b border-excel-gridline">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={
                isActive
                  ? "border-b-2 border-excel-green px-4 py-2 text-sm font-semibold text-excel-green"
                  : "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "file" ? (
        <FileMenu
          fileId={fileId}
          sheetNames={sheetNames}
          activeSheet={activeSheet}
          selectedFile={selectedFile}
          isUploading={isUploading}
          onFileChange={onFileChange}
          onUpload={onUpload}
        />
      ) : null}
      {activeTab === "home" ? (
        <HomeTab
          fileId={fileId}
          activeSheet={activeSheet}
          selection={selection}
          onApplied={onEngineCommitted}
          onPreview={onFormattingPreview}
        />
      ) : null}
      {activeTab === "insert" ? (
        <InsertTab
          fileId={fileId}
          activeSheet={activeSheet}
          sheet={sheet}
          selection={selection}
          onApplied={onEngineCommitted}
        />
      ) : null}
      {activeTab === "formulas" ? (
        <FormulasTab fileId={fileId} activeSheet={activeSheet} selection={selection} onApplied={onEngineCommitted} />
      ) : null}
      {activeTab === "data" ? (
        <DataTab
          fileId={fileId}
          sheetNames={sheetNames}
          activeSheet={activeSheet}
          selection={selection}
          onCommitted={onEngineCommitted}
        />
      ) : null}
    </div>
  );
}

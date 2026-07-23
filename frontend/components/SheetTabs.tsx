type SheetTabsProps = {
  sheetNames: string[];
  activeSheet: string;
  onSelect: (sheetName: string) => void;
};

export function SheetTabs({ sheetNames, activeSheet, onSelect }: SheetTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
      {sheetNames.map((name) => {
        const isActive = name === activeSheet;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(name)}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950"
                : "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            }
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

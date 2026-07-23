type SheetTabsProps = {
  sheetNames: string[];
  activeSheet: string;
  onSelect: (sheetName: string) => void;
};

export function SheetTabs({ sheetNames, activeSheet, onSelect }: SheetTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-excel-gridline pb-3">
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
                ? "rounded bg-excel-green px-3 py-1.5 text-sm font-semibold text-white"
                : "rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200"
            }
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

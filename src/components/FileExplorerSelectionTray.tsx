interface FileExplorerSelectionTrayProps {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
}

export default function FileExplorerSelectionTray({
  selectedCount,
  onDelete,
  onClear,
}: FileExplorerSelectionTrayProps) {
  return (
    <>
      <div className="sr-only" aria-live="polite" role="status">
        {selectedCount > 1
          ? `${selectedCount} items selected`
          : selectedCount === 1
            ? '1 item selected'
            : 'No items selected'}
      </div>

      {selectedCount > 1 && (
        <div className="pointer-events-none absolute inset-x-2 bottom-3 z-20 flex justify-center">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-[#161b22]/95 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-zinc-200">
              {selectedCount} selected
            </span>
            <button
              onClick={onDelete}
              className="rounded-full px-2 py-1 text-[10px] font-medium text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors cursor-pointer"
              title={`Delete ${selectedCount} selected items`}
            >
              Delete
            </button>
            <button
              onClick={onClear}
              className="rounded-full px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
              title="Clear selection"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
}

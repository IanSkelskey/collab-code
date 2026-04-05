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
          <div className="cc-menu pointer-events-auto inline-flex items-center gap-2 rounded-full px-3 py-2">
            <span className="cc-text-primary text-[11px] font-medium">
              {selectedCount} selected
            </span>
            <button
              onClick={onDelete}
              className="cursor-pointer rounded-full px-2 py-1 text-[10px] font-medium text-[var(--cc-danger)] transition-colors hover:bg-[var(--cc-bg-hover)]"
              title={`Delete ${selectedCount} selected items`}
            >
              Delete
            </button>
            <button
              onClick={onClear}
              className="cc-button-ghost cursor-pointer rounded-full px-2 py-1 text-[10px] font-medium"
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

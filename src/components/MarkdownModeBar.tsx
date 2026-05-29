import type { MarkdownViewMode } from '../hooks/useWorkspaceLayout';

interface MarkdownModeBarProps {
  mode: MarkdownViewMode;
  onChange: (mode: MarkdownViewMode) => void;
}

const viewModes: Array<{ mode: MarkdownViewMode; label: string }> = [
  { mode: 'write', label: 'Write' },
  { mode: 'split', label: 'Split' },
  { mode: 'preview', label: 'Preview' },
];

export default function MarkdownModeBar({ mode, onChange }: MarkdownModeBarProps) {
  return (
    <div className="cc-topbar cc-divider flex shrink-0 items-center justify-end gap-2 border-b px-3 py-1.5">
      <div
        role="group"
        aria-label="Markdown view"
        className="cc-segmented-control flex items-center rounded-lg p-0.5"
      >
        {viewModes.map((viewMode) => {
          const isActive = viewMode.mode === mode;

          return (
            <button
              key={viewMode.mode}
              onClick={() => onChange(viewMode.mode)}
              aria-pressed={isActive}
              className={`cc-segmented-button cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium ${
                isActive ? 'cc-segmented-button-active' : ''
              }`}
            >
              {viewMode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

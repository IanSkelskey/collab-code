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
    <div className="shrink-0 flex items-center justify-between gap-3 border-b border-zinc-700/50 bg-[#161b22] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Markdown
      </div>

      <div className="flex items-center rounded-lg border border-zinc-700/80 bg-[#0d1117] p-0.5">
        {viewModes.map((viewMode) => {
          const isActive = viewMode.mode === mode;

          return (
            <button
              key={viewMode.mode}
              onClick={() => onChange(viewMode.mode)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/18 text-emerald-300'
                  : 'text-zinc-400 hover:text-zinc-200'
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

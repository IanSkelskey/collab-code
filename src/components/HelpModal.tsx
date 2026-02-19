import { useEffect } from 'react';

interface HelpModalProps {
  onClose: () => void;
}

const shortcuts: { keys: string; desc: string }[] = [
  { keys: 'Ctrl + Enter', desc: 'Run code' },
  { keys: 'Ctrl + S', desc: 'Download current file' },
  { keys: 'Ctrl + Shift + S', desc: 'Download workspace as .zip' },
  { keys: 'Alt + N', desc: 'New file' },
  { keys: 'Alt + Shift + N', desc: 'New folder' },
  { keys: 'Ctrl + B', desc: 'Toggle file explorer' },
  { keys: 'Ctrl + `', desc: 'Toggle terminal' },
  { keys: '↑ / ↓', desc: 'Terminal command history' },
];

const tips: string[] = [
  'Share the URL to invite collaborators — they join instantly.',
  'Drag files onto folders in the explorer to move them.',
  'Right-click files and folders for rename, delete, and more.',
  'Deleted files show an undo toast — click it within 5 seconds to restore.',
  'Use the terminal for quick file operations: ls, cd, mkdir, touch, rm, mv, cat.',
  'Java files can be run directly with Ctrl+Enter or the Run button.',
];

export default function HelpModal({ onClose }: HelpModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdrop}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
    >
      <div className="bg-[#1e2030] border border-zinc-700 rounded-lg shadow-2xl shadow-black/60 w-[420px] max-w-[92vw] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-700/60">
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
            </svg>
            Help
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-1 -m-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Keyboard shortcuts */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Keyboard Shortcuts</h3>
            <div className="space-y-1.5">
              {shortcuts.map((s) => (
                <div key={s.keys} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{s.desc}</span>
                  <kbd className="bg-zinc-800 border border-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ml-3">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Tips</h3>
            <ul className="space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="text-xs text-zinc-400 flex gap-2">
                  <span className="text-emerald-400 shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Footer / Signature */}
        <div className="px-5 py-3 border-t border-zinc-700/60 text-center">
          <span className="text-[11px] text-zinc-500">
            Made with <span className="text-red-400">❤️</span> by{' '}
            <a
              href="https://github.com/IanSkelskey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-emerald-400 transition-colors underline underline-offset-2"
            >
              Ian Skelskey
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

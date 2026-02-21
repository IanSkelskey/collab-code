import { useEffect, useState } from 'react';
import { primaryLanguage } from '../config/languages';
import { HelpCircleIcon, CloseIcon, InfoCircleIcon } from './Icons';

interface HelpModalProps {
  onClose: () => void;
}

const shortcuts: { keys: string; desc: string }[] = [
  { keys: 'Ctrl + Enter', desc: 'Run code' },
  { keys: 'Ctrl + S', desc: 'Download current file' },
  { keys: 'Ctrl + Shift + S', desc: 'Download workspace as .zip' },
  { keys: 'Alt + N', desc: 'New file' },
  { keys: 'Alt + Shift + N', desc: 'New folder' },
  { keys: 'Alt + Shift + F', desc: 'Format document' },
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
  `${primaryLanguage.label} files can be run directly with Ctrl+Enter or the Run button.`,
];

type Tab = 'shortcuts' | 'tips';

export default function HelpModal({ onClose }: HelpModalProps) {
  const [tab, setTab] = useState<Tab>('shortcuts');

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
        {/* Header with tabs */}
        <div className="px-4 sm:px-5 pt-3 sm:pt-4 border-b border-zinc-700/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <HelpCircleIcon className="w-4 h-4 text-emerald-400" strokeWidth={2} />
              Help
            </h2>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-1 -m-1"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setTab('shortcuts')}
              className={`pb-2 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
                tab === 'shortcuts'
                  ? 'text-emerald-400 border-emerald-400'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              Shortcuts
            </button>
            <button
              onClick={() => setTab('tips')}
              className={`pb-2 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
                tab === 'tips'
                  ? 'text-emerald-400 border-emerald-400'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              Tips
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 sm:py-4">
          {tab === 'shortcuts' && (
            <div className="space-y-1.5">
              {shortcuts.map((s) => (
                <div key={s.keys} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-zinc-400 min-w-0">{s.desc}</span>
                  <kbd className="bg-zinc-800 border border-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          )}
          {tab === 'tips' && (
            <ul className="space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="text-xs text-zinc-400 flex gap-2">
                  <span className="text-emerald-400 shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-t border-zinc-700/60 flex flex-col items-center gap-1.5 sm:gap-2">
          <a
            href="https://github.com/IanSkelskey/collab-code/issues/new/choose"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-700/60 hover:bg-zinc-600 transition-colors"
          >
            <InfoCircleIcon className="w-3.5 h-3.5" />
            Report a Bug or Request a Feature
          </a>
          <div className="text-xs text-zinc-400 font-mono">v{__APP_VERSION__}</div>
          <span className="text-xs text-zinc-400">
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

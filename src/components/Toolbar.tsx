import { useState, useRef, useEffect, useCallback } from 'react';
import PeerAvatars from './PeerAvatars';
import type { VirtualFS } from '../hooks/useVirtualFS';
import {
  SpinnerIcon, PlayIcon, LinkIcon, ExplorerFolderIcon,
  FormatIcon, DownloadIcon, CheckIcon, CopyIcon,
  FileDocIcon, ArchiveIcon, GearIcon, HelpCircleIcon,
} from './Icons';

interface ToolbarProps {
  roomId: string;
  connected: boolean;
  peerCount: number;
  running: boolean;
  onRun: () => void;
  onExitRoom: () => void;
  onSaveAll: () => Promise<void>;
  fs?: VirtualFS;
  onConfirmLeave: (opts: {
    title: string;
    message: string;
    confirmLabel: string;
    secondaryLabel: string;
    onConfirm: () => void;
    onSecondary: () => void;
  }) => void;
}

export default function Toolbar({
  roomId,
  connected,
  peerCount,
  running,
  onRun,
  onExitRoom,
  onSaveAll,
  onConfirmLeave,
  fs,
}: ToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}#${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Share this link:', url);
    }
  }, [roomId]);

  return (
      <header className="flex items-center justify-between gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#161b22] border-b border-zinc-700/50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Logo / Title */}
          <button
            onClick={() => {
              onConfirmLeave({
                title: 'Leave workspace?',
                message: 'Your work is only stored in each peer\'s browser. If all peers leave, unsaved work may be lost.',
                confirmLabel: 'Leave',
                secondaryLabel: 'Download & Leave',
                onConfirm: onExitRoom,
                onSecondary: () => { onSaveAll().then(onExitRoom); },
              });
            }}
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            title="Back to home"
          >
            <img src="/collab-code/logo.svg" alt="Collab Code" className="w-6 h-6 sm:w-7 sm:h-7" />
            <h1 className="text-sm sm:text-base font-semibold tracking-tight">
              <span className="text-zinc-100 hidden xs:inline">Collab Code</span>
              <span className="text-xs text-zinc-400 font-normal font-mono ml-1.5 hidden sm:inline">v{__APP_VERSION__}</span>
            </h1>
          </button>

          <div className="w-px h-5 bg-zinc-700 hidden sm:block" />

          {/* Run button */}
          <button
            onClick={onRun}
            disabled={running}
            title="Run code (Ctrl+Enter)"
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer touch-manipulation"
          >
            {running ? (
              <SpinnerIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{running ? 'Running...' : 'Run'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <PeerAvatars fs={fs} />

          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
            }`}
            title={connected ? 'Connected to server' : 'Connecting...'}
          />

          <span className="text-xs text-zinc-400 hidden sm:inline">
            {peerCount} {peerCount === 1 ? 'peer' : 'peers'}
          </span>

          <div className="w-px h-5 bg-zinc-700 hidden sm:block" />

          <span className="text-xs text-zinc-500 font-mono hidden md:inline">
            #{roomId}
          </span>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 transition-colors cursor-pointer touch-manipulation"
          >
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </header>
  );
}

// ── Activity bar (vertical icon strip) ──

export interface ActivityBarProps {
  explorerVisible: boolean;
  codeCopied: boolean;
  fontSize: number;
  activeFileName: string | null;
  onToggleExplorer: () => void;
  onFormat: () => void;
  onCopyCode: () => void;
  onSaveFile: () => void;
  onSaveAll: () => Promise<void>;
  onFontSizeUp: () => void;
  onFontSizeDown: () => void;
  onHelpOpen: () => void;
}

export function ActivityBar({
  explorerVisible,
  codeCopied,
  fontSize,
  activeFileName,
  onToggleExplorer,
  onFormat,
  onCopyCode,
  onSaveFile,
  onSaveAll,
  onFontSizeUp,
  onFontSizeDown,
  onHelpOpen,
}: ActivityBarProps) {
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setSaveMenuOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div className="shrink-0 w-10 bg-[#0d1117] border-r border-zinc-700/50 flex flex-col items-center pt-1 pb-2">
      {/* Top — Explorer */}
      <button
        onClick={onToggleExplorer}
        title="Toggle Explorer (Ctrl+B)"
        className={`p-2 rounded transition-colors cursor-pointer ${
          explorerVisible
            ? 'text-white bg-zinc-700/50'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <ExplorerFolderIcon className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {/* Bottom section */}
      <div className="flex flex-col items-center gap-0.5">
        {/* Format */}
        <button
          onClick={onFormat}
          title="Format Document (Alt+Shift+F)"
          className="p-2 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors cursor-pointer"
        >
          <FormatIcon className="w-5 h-5" />
        </button>

        {/* Export / Download */}
        <div ref={saveMenuRef} className="relative">
          <button
            onClick={() => { setSaveMenuOpen(v => !v); setSettingsOpen(false); }}
            title="Export & Copy"
            className={`p-2 rounded transition-colors cursor-pointer ${
              saveMenuOpen ? 'text-white bg-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50'
            }`}
          >
            <DownloadIcon className="w-5 h-5" />
          </button>
          {saveMenuOpen && (
            <div className="absolute left-full bottom-0 ml-2 z-50 min-w-[200px] bg-[#1e2030] border border-zinc-700 rounded-lg shadow-xl shadow-black/40 py-1">
              <button
                onClick={onCopyCode}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700/60 transition-colors text-left cursor-pointer"
              >
                {codeCopied ? (
                  <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <CopyIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                )}
                <span className="font-medium">{codeCopied ? 'Copied!' : 'Copy Code'}</span>
              </button>
              <div className="mx-2 my-1 border-t border-zinc-700/60" />
              <button
                onClick={() => { onSaveFile(); setSaveMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700/60 transition-colors text-left cursor-pointer"
              >
                <FileDocIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                <div>
                  <div className="font-medium">Save File <span className="text-zinc-400 font-normal ml-1">Ctrl+S</span></div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Download {activeFileName ?? 'current file'}
                  </div>
                </div>
              </button>
              <div className="mx-2 my-1 border-t border-zinc-700/60" />
              <button
                onClick={() => { onSaveAll(); setSaveMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700/60 transition-colors text-left cursor-pointer"
              >
                <ArchiveIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-medium">Save All <span className="text-emerald-400">.zip</span> <span className="text-zinc-400 font-normal ml-1">Ctrl+Shift+S</span></div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Download entire workspace
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Settings */}
        <div ref={settingsRef} className="relative">
          <button
            onClick={() => { setSettingsOpen(v => !v); setSaveMenuOpen(false); }}
            title="Settings"
            className={`p-2 rounded transition-colors cursor-pointer ${
              settingsOpen ? 'text-white bg-zinc-700/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50'
            }`}
          >
            <GearIcon className="w-5 h-5" />
          </button>
          {settingsOpen && (
            <div className="absolute left-full bottom-0 ml-2 z-50 min-w-[160px] bg-[#1e2030] border border-zinc-700 rounded-lg shadow-xl shadow-black/40 py-3 px-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Font Size</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onFontSizeDown}
                  title="Decrease font size"
                  className="px-2 py-1 rounded text-xs font-bold bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 transition-colors cursor-pointer leading-none"
                >
                  A−
                </button>
                <span className="text-xs text-zinc-300 font-mono min-w-[2ch] text-center">{fontSize}</span>
                <button
                  onClick={onFontSizeUp}
                  title="Increase font size"
                  className="px-2 py-1 rounded text-sm font-bold bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 transition-colors cursor-pointer leading-none"
                >
                  A+
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help */}
        <button
          onClick={onHelpOpen}
          title="Help & Shortcuts"
          className="p-2 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors cursor-pointer"
        >
          <HelpCircleIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

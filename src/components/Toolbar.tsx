import { useState, useRef, useEffect, useCallback } from 'react';
import PeerAvatars from './PeerAvatars';
import type { ExecutionTarget } from '../hooks/useExecution';
import { getBaseName } from '../lib/vfsPaths';
import type { PeerState } from '../types';
import type { ServerStatusSnapshot } from '../types/serverStatus';
import {
  SpinnerIcon,
  PlayIcon,
  LinkIcon,
  ExplorerFolderIcon,
  SearchIcon,
  FormatIcon,
  DownloadIcon,
  CheckIcon,
  CopyIcon,
  FileDocIcon,
  ArchiveIcon,
  GearIcon,
  HelpCircleIcon,
  ChevronDownIcon,
  EyeIcon,
  CloseIcon,
  Volume2Icon,
  VolumeXIcon,
} from './Icons';
import ThemePicker from './ThemePicker';

interface ToolbarProps {
  roomId: string;
  peerCount: number;
  peers: PeerState[];
  serverStatus: ServerStatusSnapshot;
  followedPeer: PeerState | null;
  followedPeerId: number | null;
  running: boolean;
  onRun: () => void;
  currentRunTarget: ExecutionTarget | null;
  runTargets: ExecutionTarget[];
  onRunTargetSelect: (filePath: string) => void;
  onExitRoom: () => void;
  onSaveAll: () => Promise<void>;
  onToggleFollowPeer: (peer: PeerState) => void;
  onStopFollowing: () => void;
  onOpenServerHelp: () => void;
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
  peerCount,
  peers,
  serverStatus,
  followedPeer,
  followedPeerId,
  running,
  onRun,
  currentRunTarget,
  runTargets,
  onRunTargetSelect,
  onExitRoom,
  onSaveAll,
  onToggleFollowPeer,
  onStopFollowing,
  onOpenServerHelp,
  onConfirmLeave,
}: ToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const runMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (runMenuRef.current && !runMenuRef.current.contains(event.target as Node)) {
        setRunMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const handlePrimaryRun = useCallback(() => {
    if (!currentRunTarget && runTargets.length > 1) {
      setRunMenuOpen((open) => !open);
      return;
    }

    onRun();
  }, [currentRunTarget, onRun, runTargets.length]);

  const handleSelectRunTarget = useCallback(
    (filePath: string) => {
      setRunMenuOpen(false);
      onRunTargetSelect(filePath);
    },
    [onRunTargetSelect],
  );

  const runButtonLabel = running
    ? 'Running...'
    : currentRunTarget
      ? `Run ${getBaseName(currentRunTarget.filePath)}`
      : runTargets.length > 1
        ? 'Choose Run Target'
        : 'Run';

  const runButtonTitle = currentRunTarget
    ? `Run ${currentRunTarget.filePath}. Ctrl+Enter runs the active editor.`
    : runTargets.length > 1
      ? 'Choose which runnable file to execute.'
      : 'Run code. Ctrl+Enter runs the active editor.';

  const statusButtonClassName = getServerStatusButtonClassName(serverStatus.summary.tone);
  const statusDotClassName = getServerStatusDotClassName(serverStatus.summary.tone);

  return (
    <header className="cc-topbar cc-divider relative z-30 flex shrink-0 items-center justify-between gap-2 overflow-visible border-b px-3 py-1.5 sm:px-4 sm:py-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={() => {
            onConfirmLeave({
              title: 'Leave workspace?',
              message:
                "Your work is only stored in each peer's browser. If all peers leave, unsaved work may be lost.",
              confirmLabel: 'Leave',
              secondaryLabel: 'Download & Leave',
              onConfirm: onExitRoom,
              onSecondary: () => {
                onSaveAll().then(onExitRoom);
              },
            });
          }}
          className="flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-80 sm:gap-2"
          title="Back to home"
        >
          <img src="/collab-code/logo.svg" alt="Collab Code" className="w-6 h-6 sm:w-7 sm:h-7" />
          <h1 className="text-sm sm:text-base font-semibold tracking-tight">
            <span className="cc-text-primary hidden xs:inline">Collab Code</span>
            <span className="cc-text-muted ml-1.5 hidden font-mono text-xs font-normal sm:inline">
              v{__APP_VERSION__}
            </span>
          </h1>
        </button>

        <div className="cc-divider hidden h-5 w-px border-l sm:block" />

        <div ref={runMenuRef} className="relative flex items-stretch">
          <button
            onClick={handlePrimaryRun}
            disabled={running}
            title={runButtonTitle}
            className="cc-button-primary flex cursor-pointer touch-manipulation items-center gap-1.5 rounded-l-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-4 sm:py-2"
          >
            {running ? (
              <SpinnerIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline max-w-[11rem] truncate">{runButtonLabel}</span>
          </button>
          <button
            onClick={() => setRunMenuOpen((open) => !open)}
            disabled={running}
            title="Choose run target"
            className="cc-button-primary cc-divider cursor-pointer rounded-r-md border-l px-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronDownIcon
              className={`w-4 h-4 transition-transform ${runMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {runMenuOpen && (
            <div className="cc-menu absolute left-0 top-full z-50 mt-2 min-w-[260px] max-w-[320px] overflow-hidden rounded-lg">
              <div className="cc-divider border-b px-3 py-2">
                <div className="cc-section-label text-[10px] font-semibold">Run Targets</div>
                <div className="cc-text-muted mt-1 text-[11px]">
                  Ctrl+Enter always runs the active editor.
                </div>
              </div>

              {runTargets.length === 0 ? (
                <div className="cc-text-muted px-3 py-3 text-xs">
                  No runnable Java or Python files found.
                </div>
              ) : (
                <div className="py-1">
                  {runTargets.map((target) => {
                    const isCurrentTarget = currentRunTarget?.filePath === target.filePath;

                    return (
                      <button
                        key={target.filePath}
                        onClick={() => handleSelectRunTarget(target.filePath)}
                        className={`w-full px-3 py-2 text-left transition-colors cursor-pointer ${
                          isCurrentTarget
                            ? 'bg-[var(--cc-bg-selection)]'
                            : 'hover:bg-[var(--cc-bg-hover)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="cc-text-primary text-xs font-medium">
                            {getBaseName(target.filePath)}
                          </span>
                          {isCurrentTarget && (
                            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--cc-accent)]">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="cc-text-muted mt-0.5 break-all text-[11px]">
                          {target.filePath}
                        </div>
                        <div className="cc-text-faint mt-0.5 text-[10px]">
                          {target.language.label} entry: {target.entryPoint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <PeerAvatars
          peers={peers}
          followedPeerId={followedPeerId}
          onToggleFollowPeer={onToggleFollowPeer}
        />

        {!followedPeer && peerCount > 1 && (
          <div className="hidden items-center gap-1.5 lg:flex">
            <EyeIcon className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
            <span className="cc-text-muted text-[10px]">Click an avatar to follow</span>
          </div>
        )}

        {followedPeer && (
          <div className="cc-divider hidden min-w-0 max-w-[16rem] items-center gap-1.5 rounded-full border border-[var(--cc-accent)] bg-[var(--cc-bg-selection)] px-2 py-1 md:flex">
            <EyeIcon className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
            <div className="min-w-0">
              <div className="cc-text-primary truncate text-[11px] font-medium">
                Following {followedPeer.name}
              </div>
            </div>
            <span className="cc-text-muted hidden text-[10px] lg:inline">Locked</span>
            <button
              onClick={onStopFollowing}
              title={`Stop following ${followedPeer.name}`}
              aria-label={`Stop following ${followedPeer.name}`}
              className="cc-icon-button -mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        )}

        <span className="cc-text-muted hidden text-xs sm:inline">
          {peerCount} {peerCount === 1 ? 'peer' : 'peers'}
        </span>

        <div className="cc-divider hidden h-5 w-px border-l sm:block" />

        <button
          onClick={onOpenServerHelp}
          title={serverStatus.summary.detail}
          className={statusButtonClassName}
        >
          <span className={statusDotClassName} />
          <span className="hidden sm:inline">{serverStatus.summary.label}</span>
        </button>

        <div className="cc-divider hidden h-5 w-px border-l sm:block" />

        <span className="cc-text-faint hidden font-mono text-xs md:inline">#{roomId}</span>

        <button
          onClick={handleShare}
          className="cc-button-secondary flex cursor-pointer touch-manipulation items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium sm:gap-2 sm:px-4 sm:py-2"
        >
          <LinkIcon className="w-4 h-4" />
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
        </button>
      </div>
    </header>
  );
}

function getServerStatusButtonClassName(tone: ServerStatusSnapshot['summary']['tone']): string {
  const toneClasses =
    tone === 'success'
      ? 'border-[color:color-mix(in_srgb,var(--cc-success)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-success)_12%,var(--cc-bg-elevated)_88%)] text-[var(--cc-success)] hover:bg-[color:color-mix(in_srgb,var(--cc-success)_18%,var(--cc-bg-elevated)_82%)]'
      : tone === 'danger'
        ? 'border-[color:color-mix(in_srgb,var(--cc-danger)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-danger)_12%,var(--cc-bg-elevated)_88%)] text-[var(--cc-danger)] hover:bg-[color:color-mix(in_srgb,var(--cc-danger)_18%,var(--cc-bg-elevated)_82%)]'
        : tone === 'warning'
          ? 'border-[color:color-mix(in_srgb,var(--cc-warning)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-warning)_12%,var(--cc-bg-elevated)_88%)] text-[var(--cc-warning)] hover:bg-[color:color-mix(in_srgb,var(--cc-warning)_18%,var(--cc-bg-elevated)_82%)]'
          : 'border-[var(--cc-border)] bg-[color:color-mix(in_srgb,var(--cc-bg-elevated)_90%,transparent)] cc-text-muted hover:bg-[var(--cc-bg-hover)] hover:text-[var(--cc-text-primary)]';

  return `flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${toneClasses}`;
}

function getServerStatusDotClassName(tone: ServerStatusSnapshot['summary']['tone']): string {
  const toneClass =
    tone === 'success'
      ? 'bg-[var(--cc-success)]'
      : tone === 'danger'
        ? 'bg-[var(--cc-danger)]'
        : tone === 'warning'
          ? 'bg-[var(--cc-warning)]'
          : 'bg-[var(--cc-text-faint)]';

  return `h-2 w-2 shrink-0 rounded-full ${toneClass}`;
}

export interface ActivityBarProps {
  explorerVisible: boolean;
  searchVisible: boolean;
  codeCopied: boolean;
  fontSize: number;
  presenceSoundsEnabled: boolean;
  presenceSoundVolume: number;
  activeFileName: string | null;
  onToggleExplorer: () => void;
  onToggleSearch: () => void;
  onFormat: () => void;
  onCopyCode: () => void;
  onSaveFile: () => void;
  onSaveAll: () => Promise<void>;
  onFontSizeUp: () => void;
  onFontSizeDown: () => void;
  onPresenceSoundsEnabledChange: (enabled: boolean) => void;
  onPresenceSoundVolumeChange: (volume: number) => void;
  onHelpOpen: () => void;
}

export function ActivityBar({
  explorerVisible,
  searchVisible,
  codeCopied,
  fontSize,
  presenceSoundsEnabled,
  presenceSoundVolume,
  activeFileName,
  onToggleExplorer,
  onToggleSearch,
  onFormat,
  onCopyCode,
  onSaveFile,
  onSaveAll,
  onFontSizeUp,
  onFontSizeDown,
  onPresenceSoundsEnabledChange,
  onPresenceSoundVolumeChange,
  onHelpOpen,
}: ActivityBarProps) {
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const presenceSoundVolumePercent = Math.round(presenceSoundVolume * 100);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(event.target as Node)) {
        setSaveMenuOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="cc-sidebar-shell cc-divider flex w-10 shrink-0 flex-col items-center border-r pt-1 pb-2">
      <button
        onClick={onToggleExplorer}
        title="Toggle Explorer (Ctrl+B)"
        className={`p-2 rounded transition-colors cursor-pointer ${
          explorerVisible ? 'cc-icon-button-active' : 'cc-icon-button'
        }`}
      >
        <ExplorerFolderIcon className="w-5 h-5" />
      </button>

      <button
        onClick={onToggleSearch}
        title="Search Files (Ctrl+Shift+F)"
        className={`p-2 rounded transition-colors cursor-pointer ${
          searchVisible ? 'cc-icon-button-active' : 'cc-icon-button'
        }`}
      >
        <SearchIcon className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={onFormat}
          title="Format Document (Alt+Shift+F)"
          className="cc-icon-button cursor-pointer rounded p-2"
        >
          <FormatIcon className="w-5 h-5" />
        </button>

        <div ref={saveMenuRef} className="relative">
          <button
            onClick={() => {
              setSaveMenuOpen((open) => !open);
              setSettingsOpen(false);
            }}
            title="Export & Copy"
            className={`p-2 rounded transition-colors cursor-pointer ${
              saveMenuOpen ? 'cc-icon-button-active' : 'cc-icon-button'
            }`}
          >
            <DownloadIcon className="w-5 h-5" />
          </button>
          {saveMenuOpen && (
            <div className="cc-menu absolute bottom-0 left-full z-50 ml-2 min-w-[200px] rounded-lg py-1">
              <button
                onClick={onCopyCode}
                className="cc-text-primary hover:bg-[var(--cc-bg-hover)] flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
              >
                {codeCopied ? (
                  <CheckIcon className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
                ) : (
                  <CopyIcon className="cc-text-muted h-4 w-4 shrink-0" />
                )}
                <span className="font-medium">{codeCopied ? 'Copied!' : 'Copy Code'}</span>
              </button>
              <div className="cc-divider mx-2 my-1 border-t" />
              <button
                onClick={() => {
                  onSaveFile();
                  setSaveMenuOpen(false);
                }}
                className="cc-text-primary hover:bg-[var(--cc-bg-hover)] flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
              >
                <FileDocIcon className="cc-text-muted h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">
                    Save File <span className="cc-text-muted ml-1 font-normal">Ctrl+S</span>
                  </div>
                  <div className="cc-text-muted mt-0.5 text-[10px]">
                    Download {activeFileName ?? 'current file'}
                  </div>
                </div>
              </button>
              <div className="cc-divider mx-2 my-1 border-t" />
              <button
                onClick={() => {
                  void onSaveAll();
                  setSaveMenuOpen(false);
                }}
                className="cc-text-primary hover:bg-[var(--cc-bg-hover)] flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
              >
                <ArchiveIcon className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
                <div>
                  <div className="font-medium">
                    Save All <span className="text-[var(--cc-accent)]">.zip</span>{' '}
                    <span className="cc-text-muted ml-1 font-normal">Ctrl+Shift+S</span>
                  </div>
                  <div className="cc-text-muted mt-0.5 text-[10px]">Download entire workspace</div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div ref={settingsRef} className="relative">
          <button
            onClick={() => {
              setSettingsOpen((open) => !open);
              setSaveMenuOpen(false);
            }}
            title="Settings"
            className={`p-2 rounded transition-colors cursor-pointer ${
              settingsOpen ? 'cc-icon-button-active' : 'cc-icon-button'
            }`}
          >
            <GearIcon className="w-5 h-5" />
          </button>
          {settingsOpen && (
            <div className="cc-menu absolute bottom-0 left-full z-50 ml-2 w-[280px] max-w-[calc(100vw-3rem)] rounded-xl px-3 py-3.5">
              <div className="space-y-3">
                <section>
                  <div className="cc-section-label mb-2 text-[10px] font-semibold">Appearance</div>
                  <ThemePicker />
                </section>

                <div className="cc-divider border-t" />

                <section>
                  <div className="cc-section-label mb-2 text-[10px] font-semibold">Sound</div>
                  <div className="rounded-xl border border-[var(--cc-border)] bg-[color:color-mix(in_srgb,var(--cc-bg-elevated)_88%,transparent)] p-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:color-mix(in_srgb,var(--cc-bg-selection)_70%,var(--cc-bg-elevated)_30%)] text-[var(--cc-accent)]">
                          {presenceSoundsEnabled ? (
                            <Volume2Icon className="h-4 w-4" />
                          ) : (
                            <VolumeXIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="cc-text-primary text-xs font-medium">Presence sounds</div>
                          <div className="cc-text-muted mt-0.5 text-[10px] leading-relaxed">
                            Play a quiet chime when peers join or leave.
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={presenceSoundsEnabled}
                        aria-label="Toggle presence sounds"
                        onClick={() => onPresenceSoundsEnabledChange(!presenceSoundsEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
                          presenceSoundsEnabled
                            ? 'border-[color:color-mix(in_srgb,var(--cc-accent)_48%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-accent)_32%,transparent)]'
                            : 'border-[var(--cc-border)] bg-[var(--cc-bg-panel-alt)]'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-[var(--cc-bg-elevated)] shadow-sm transition-transform ${
                            presenceSoundsEnabled
                              ? 'translate-x-[1.05rem]'
                              : 'translate-x-[0.18rem]'
                          }`}
                        />
                      </button>
                    </div>

                    <div
                      className={`mt-3 flex items-center gap-2 ${presenceSoundsEnabled ? '' : 'opacity-50'}`}
                    >
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={presenceSoundVolumePercent}
                        disabled={!presenceSoundsEnabled}
                        onChange={(event) =>
                          onPresenceSoundVolumeChange(Number(event.target.value) / 100)
                        }
                        aria-label="Presence sound volume"
                        className="h-1.5 flex-1 cursor-pointer accent-[var(--cc-accent)] disabled:cursor-not-allowed"
                      />
                      <span className="cc-text-secondary w-9 text-right font-mono text-[10px]">
                        {presenceSoundVolumePercent}%
                      </span>
                    </div>
                  </div>
                </section>

                <div className="cc-divider border-t" />

                <section>
                  <div className="cc-section-label mb-2 text-[10px] font-semibold">Font Size</div>
                  <div className="rounded-xl border border-[var(--cc-border)] bg-[color:color-mix(in_srgb,var(--cc-bg-elevated)_88%,transparent)] p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="cc-text-primary text-xs font-medium">Editor text</div>
                        <div className="cc-text-muted mt-0.5 text-[10px]">
                          Current size: {fontSize}px
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={onFontSizeDown}
                          title="Decrease font size"
                          className="cc-button-secondary cursor-pointer rounded-md px-2 py-1 text-xs font-bold leading-none"
                        >
                          A-
                        </button>
                        <span className="cc-text-secondary min-w-[3ch] text-center font-mono text-xs">
                          {fontSize}
                        </span>
                        <button
                          onClick={onFontSizeUp}
                          title="Increase font size"
                          className="cc-button-secondary cursor-pointer rounded-md px-2 py-1 text-sm font-bold leading-none"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onHelpOpen}
          title="Help & Shortcuts"
          className="cc-icon-button cursor-pointer rounded p-2"
        >
          <HelpCircleIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

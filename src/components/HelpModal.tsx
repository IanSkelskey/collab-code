import { useEffect, useState, type ReactNode } from 'react';
import { HelpCircleIcon, CloseIcon, RefreshIcon } from './Icons';
import ModalOverlay from './ModalOverlay';
import GetInvolvedActions from './GetInvolvedActions';
import type { ServerStatusSnapshot, ServerStatusTone } from '../types/serverStatus';
import './HelpModal.css';

interface HelpModalProps {
  onClose: () => void;
  serverStatus: ServerStatusSnapshot;
  initialTab?: HelpModalTab;
}

interface ShortcutItem {
  keys: string;
  desc: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
  columns?: 1 | 2;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Workspace',
    items: [
      { keys: 'Ctrl/Cmd + B', desc: 'Toggle Explorer' },
      { keys: 'Ctrl/Cmd + Shift + F', desc: 'Toggle workspace search' },
      { keys: 'Ctrl/Cmd + `', desc: 'Toggle terminal' },
      { keys: 'Ctrl/Cmd + S', desc: 'Download current file' },
      { keys: 'Ctrl/Cmd + Shift + S', desc: 'Download workspace as .zip' },
    ],
  },
  {
    title: 'Editor & Files',
    items: [
      { keys: 'Ctrl/Cmd + Enter', desc: 'Run the active editor' },
      { keys: 'Alt + Shift + F', desc: 'Format the active document' },
      { keys: 'Alt + N', desc: 'Create a new file from Explorer' },
      { keys: 'Alt + Shift + N', desc: 'Create a new folder in Explorer' },
    ],
  },
];

const tips: Array<{ title: string; items: string[] }> = [
  {
    title: 'Starting Rooms',
    items: [
      'Share the URL to invite collaborators instantly.',
      'Click a peer avatar to follow their file and cursor live during tutoring or demos.',
      'Following a presenter locks your editor until you stop following.',
      'New rooms can start with Java, Python, or a blank workspace.',
      'Blank rooms include one-click Java and Python starter buttons.',
    ],
  },
  {
    title: 'Working With Files',
    items: [
      'Drag files onto folders in the explorer to move them.',
      'Right-click files to copy, rename, or delete them.',
      'Undo delete toasts stay available for 5 seconds.',
    ],
  },
  {
    title: 'Running Code',
    items: [
      'Terminal commands include ls, cd, mkdir, touch, rm, mv, and cat.',
      'Use run <file> when you want to choose an exact entry file.',
      'Ctrl+Enter runs the active editor; the Run menu chooses targets.',
      'Python runs in an isolated virtual environment, and a nearby requirements.txt is installed automatically before launch.',
    ],
  },
];

export type HelpModalTab = 'about' | 'server' | 'shortcuts' | 'tips' | 'involved';

export default function HelpModal({
  onClose,
  serverStatus,
  initialTab = 'about',
}: HelpModalProps) {
  const [tab, setTab] = useState<HelpModalTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cc-card flex h-[38rem] max-h-[88vh] w-[92vw] max-w-[52rem] flex-col overflow-hidden rounded-xl sm:h-[40rem] lg:h-[44rem]">
        <div className="cc-divider border-b px-5 pt-4 sm:px-6 sm:pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="cc-text-primary flex items-center gap-2.5 text-base font-semibold">
              <HelpCircleIcon className="h-[1.125rem] w-[1.125rem] text-[var(--cc-accent)]" strokeWidth={2} />
              Help
            </h2>
            <button
              onClick={onClose}
              aria-label="Close help dialog"
              title="Close help dialog"
              className="cc-icon-button -m-1 cursor-pointer rounded-md p-1.5"
            >
              <CloseIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap gap-4">
            <TabButton
              active={tab === 'about'}
              activeClassName="border-sky-400 text-sky-400"
              inactiveClassName="cc-text-faint border-transparent hover:text-[var(--cc-text-primary)]"
              onClick={() => setTab('about')}
            >
              About
            </TabButton>
            <TabButton
              active={tab === 'shortcuts'}
              activeClassName="border-[var(--cc-accent)] text-[var(--cc-accent)]"
              inactiveClassName="cc-text-faint border-transparent hover:text-[var(--cc-text-primary)]"
              onClick={() => setTab('shortcuts')}
            >
              Shortcuts
            </TabButton>
            <TabButton
              active={tab === 'tips'}
              activeClassName="border-[var(--cc-accent)] text-[var(--cc-accent)]"
              inactiveClassName="cc-text-faint border-transparent hover:text-[var(--cc-text-primary)]"
              onClick={() => setTab('tips')}
            >
              Tips
            </TabButton>
            <TabButton
              active={tab === 'involved'}
              activeClassName="border-pink-400 text-pink-400"
              inactiveClassName="cc-text-faint border-transparent hover:text-pink-300"
              onClick={() => setTab('involved')}
            >
              Get Involved
            </TabButton>
            <TabButton
              active={tab === 'server'}
              activeClassName="border-[var(--cc-accent)] text-[var(--cc-accent)]"
              inactiveClassName="cc-text-faint border-transparent hover:text-[var(--cc-text-primary)]"
              onClick={() => setTab('server')}
            >
              Server
            </TabButton>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 py-3.5 sm:px-6 sm:py-4"
          style={{ scrollbarGutter: 'stable' }}
        >
          {tab === 'about' && (
            <div className="mx-auto flex min-h-full w-full max-w-[38rem] flex-col items-center justify-center text-center">
              <div className="flex flex-col items-center">
                <img
                  src="/collab-code/logo.svg"
                  alt="Collab Code"
                  className="mb-4 h-[4.5rem] w-[4.5rem] sm:h-[5.5rem] sm:w-[5.5rem]"
                />
                <h3 className="cc-text-primary text-base font-semibold">Collab Code</h3>
                <p className="cc-text-muted mt-3 max-w-[40rem] text-sm leading-relaxed">
                  Collaborative coding rooms for classrooms, tutoring sessions, and pair programming.
                  Share a room link, edit the same workspace, use one shared terminal session, and run
                  Java and Python together from the browser. New rooms can start with a Java starter,
                  a Python starter, or a blank workspace. Python execution stays isolated in a temporary
                  virtual environment on the server.
                </p>
                <div className="cc-panel mt-4 w-full rounded-xl border px-4 py-3">
                  <p className="cc-text-faint text-xs leading-relaxed">
                    Use <span className="cc-text-secondary font-medium">Shortcuts</span> for controls,
                    <span className="cc-text-secondary font-medium"> Tips</span> for workflow help,
                    and <span className="cc-text-secondary font-medium">Server</span> for backend status.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'server' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="cc-section-label text-[11px] font-semibold">Server Status</div>
                  <p className="cc-text-muted mt-1 text-xs">
                    {serverStatus.checkedAt
                      ? `Last checked ${formatCheckedAt(serverStatus.checkedAt)}`
                      : 'Waiting for first status check'}
                  </p>
                </div>
                <button
                  onClick={serverStatus.refresh}
                  className="cc-button-secondary cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                >
                  <RefreshIcon className="h-[1.125rem] w-[1.125rem]" />
                  Refresh
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <InfoCard label="Sync Connection">
                  <StatusBadge tone={serverStatus.summary.tone}>
                    {serverStatus.summary.label}
                  </StatusBadge>
                  <p className="cc-text-muted mt-2 text-xs leading-relaxed">
                    {serverStatus.summary.detail}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <InfoLine label="Connection">
                      {formatSyncStatus(serverStatus.syncStatus)}
                    </InfoLine>
                    <InfoLine label="Service">
                      {serverStatus.info.service ?? 'Not reported'}
                    </InfoLine>
                  </div>
                </InfoCard>

                <InfoCard label="Compatibility">
                  <StatusBadge tone={getCompatibilityTone(serverStatus.compatibility.status)}>
                    {serverStatus.compatibility.title}
                  </StatusBadge>
                  <p className="cc-text-muted mt-2 text-xs leading-relaxed">
                    {serverStatus.compatibility.detail}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <InfoLine label="Frontend">
                      <span className="cc-text-primary break-all font-mono">v{serverStatus.clientVersion}</span>
                    </InfoLine>
                    <InfoLine label="Server">
                      <span className="cc-text-primary break-all font-mono">
                        {serverStatus.info.serverVersion ? `v${serverStatus.info.serverVersion}` : 'Not reported'}
                      </span>
                    </InfoLine>
                    <InfoLine label="Protocol">
                      <span className="cc-text-primary break-all font-mono">
                        {serverStatus.info.protocolVersion !== null
                          ? `client v${serverStatus.clientProtocolVersion} / server v${serverStatus.info.protocolVersion}`
                          : `client v${serverStatus.clientProtocolVersion} / server not reported`}
                      </span>
                    </InfoLine>
                  </div>
                </InfoCard>

                <InfoCard label="Execution">
                  <StatusBadge tone={serverStatus.info.executionAllowed === false ? 'warning' : 'success'}>
                    {getExecutionStatusLabel(serverStatus)}
                  </StatusBadge>
                  <p className="cc-text-muted mt-2 text-xs leading-relaxed">
                    {getExecutionStatusDetail(serverStatus)}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <InfoLine label="Sandbox">
                      {serverStatus.info.executionSandboxStatus ?? 'Not reported'}
                    </InfoLine>
                    <InfoLine label="Capabilities">
                      {serverStatus.info.capabilities.length > 0
                        ? serverStatus.info.capabilities.join(', ')
                        : 'Not reported'}
                    </InfoLine>
                  </div>
                </InfoCard>

                <InfoCard label="Server Runtimes">
                  <div className="space-y-3">
                    <InfoLine label="Java">
                      <ServerRuntimeVersion
                        fetchState={serverStatus.fetchState}
                        available={serverStatus.info.javaAvailable}
                        version={serverStatus.info.javaVersion}
                        label="Java"
                      />
                    </InfoLine>
                    <InfoLine label="Python">
                      <ServerRuntimeVersion
                        fetchState={serverStatus.fetchState}
                        available={serverStatus.info.pythonAvailable}
                        version={serverStatus.info.pythonVersion}
                        label="Python"
                      />
                    </InfoLine>
                  </div>
                </InfoCard>
              </div>
            </div>
          )}

          {tab === 'shortcuts' && (
            <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col justify-center gap-3.5">
              <p className="cc-text-muted text-xs leading-relaxed">
                <span className="cc-text-primary font-medium">Ctrl/Cmd</span> shortcuts work with either
                Control or Command. This list focuses on the app-level shortcuts that are most useful to discover.
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {shortcutGroups.map((group) => (
                  <ShortcutSection key={group.title} group={group} />
                ))}
              </div>
            </div>
          )}

          {tab === 'tips' && (
            <div className="mx-auto grid min-h-full w-full max-w-[46rem] content-center gap-3 lg:grid-cols-2">
              <TipSection
                title={tips[0].title}
                items={tips[0].items}
                className="lg:col-span-2"
                splitItemsOnDesktop
              />
              <TipSection
                title={tips[1].title}
                items={tips[1].items}
              />
              <TipSection
                title={tips[2].title}
                items={tips[2].items}
              />
            </div>
          )}

          {tab === 'involved' && (
            <div className="mx-auto flex min-h-full w-full max-w-[42rem] flex-col items-center justify-start pt-8 sm:pt-10">
              <div className="cc-panel w-full rounded-2xl border px-5 py-6 text-center sm:px-7 sm:py-7">
                <div className="cc-text-muted mb-2 text-sm">
                  <span className="font-semibold text-pink-400">Get Involved</span> - Support, suggest, or contribute.
                </div>
                <p className="cc-text-muted mx-auto max-w-[34rem] text-sm leading-relaxed">
                  Sponsor to support ongoing development, open an issue for bugs or ideas, and star the repo
                  or send a PR if you would like to contribute.
                </p>
                <GetInvolvedActions className="mt-5 sm:justify-center" />
              </div>
            </div>
          )}
        </div>

        <div className="cc-divider flex flex-col items-center gap-1.5 border-t px-5 py-3 sm:px-6 sm:py-3.5">
          <div className="cc-text-muted font-mono text-sm">v{__APP_VERSION__}</div>
          <span className="cc-text-muted text-sm">
            Made with <span className="text-red-400">&#9829;</span> by{' '}
            <a
              href="https://github.com/IanSkelskey"
              target="_blank"
              rel="noopener noreferrer"
              className="cc-link underline underline-offset-2 transition-opacity hover:opacity-80"
            >
              Ian Skelskey
            </a>
          </span>
        </div>
      </div>
    </ModalOverlay>
  );
}

function TabButton({
  active,
  activeClassName,
  inactiveClassName,
  onClick,
  children,
}: {
  active: boolean;
  activeClassName: string;
  inactiveClassName: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer border-b-2 pb-2.5 text-sm font-medium transition-colors ${
        active ? activeClassName : inactiveClassName
      }`}
    >
      {children}
    </button>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="cc-panel rounded-xl border px-4 py-3.5">
      <div className="cc-section-label mb-2 text-[11px] font-semibold">
        {label}
      </div>
      <div className="cc-text-secondary text-sm">{children}</div>
    </div>
  );
}

function ShortcutSection({
  group,
}: {
  group: ShortcutGroup;
}) {
  return (
    <div className="cc-panel rounded-xl border px-4 py-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">
        {group.title}
      </div>
      <div className={group.columns === 2 ? 'grid gap-x-6 gap-y-1.5 sm:grid-cols-2' : 'grid gap-y-1.5'}>
        {group.items.map((shortcut) => (
          <ShortcutRow key={`${group.title}-${shortcut.keys}-${shortcut.desc}`} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
}

function ShortcutRow({
  shortcut,
}: {
  shortcut: ShortcutItem;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <div className="cc-text-primary min-w-0 text-sm leading-snug">{shortcut.desc}</div>
      <kbd className="cc-kbd shrink-0 rounded-md px-2 py-1 text-[11px] font-mono whitespace-nowrap">
        {shortcut.keys}
      </kbd>
    </div>
  );
}

function TipSection({
  title,
  items,
  className,
  splitItemsOnDesktop = false,
}: {
  title: string;
  items: string[];
  className?: string;
  splitItemsOnDesktop?: boolean;
}) {
  return (
    <div className={`cc-panel rounded-xl border px-4 py-3 ${className ?? ''}`}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">
        {title}
      </div>
      <div className={splitItemsOnDesktop ? 'grid gap-x-6 gap-y-2 lg:grid-cols-2' : 'space-y-2'}>
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2.5">
            <div className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cc-accent)] opacity-70" />
            <p className="cc-text-secondary text-sm leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: ServerStatusTone;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClassName(tone)}`}>
      {children}
    </span>
  );
}

function InfoLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="cc-text-faint shrink-0">{label}</span>
      <span className="cc-text-secondary min-w-0 text-right leading-relaxed">{children}</span>
    </div>
  );
}

function ServerRuntimeVersion({
  fetchState,
  available,
  version,
  label,
}: {
  fetchState: ServerStatusSnapshot['fetchState'];
  available: boolean | null;
  version: string | null;
  label: string;
}) {
  if (fetchState === 'loading' || fetchState === 'idle') {
    return <span className="cc-text-muted">Checking execution server...</span>;
  }

  if (fetchState === 'error') {
    return <span className="text-[var(--cc-warning)]">Unable to reach the execution server.</span>;
  }

  if (!available) {
    return <span className="text-[var(--cc-warning)]">{label} is not available on this server.</span>;
  }

  if (!version) {
    return <span className="cc-text-primary font-mono">{label} available</span>;
  }

  return <span className="cc-text-primary break-all font-mono">{version}</span>;
}

function getStatusBadgeClassName(tone: ServerStatusTone): string {
  if (tone === 'success') {
    return 'border-[color:color-mix(in_srgb,var(--cc-success)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-success)_12%,var(--cc-bg-elevated)_88%)] text-[var(--cc-success)]';
  }

  if (tone === 'danger') {
    return 'border-[color:color-mix(in_srgb,var(--cc-danger)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-danger)_12%,var(--cc-bg-elevated)_88%)] text-[var(--cc-danger)]';
  }

  if (tone === 'warning') {
    return 'border-[color:color-mix(in_srgb,var(--cc-warning)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-warning)_12%,var(--cc-bg-elevated)_88%)] text-[var(--cc-warning)]';
  }

  return 'border-[var(--cc-border)] bg-[color:color-mix(in_srgb,var(--cc-bg-elevated)_92%,transparent)] cc-text-muted';
}

function getCompatibilityTone(status: ServerStatusSnapshot['compatibility']['status']): ServerStatusTone {
  if (status === 'protocol-mismatch') {
    return 'danger';
  }

  if (status === 'version-mismatch' || status === 'legacy-server') {
    return 'warning';
  }

  if (status === 'compatible') {
    return 'success';
  }

  return 'neutral';
}

function formatSyncStatus(syncStatus: ServerStatusSnapshot['syncStatus']): string {
  if (syncStatus === 'connected') {
    return 'Connected';
  }

  if (syncStatus === 'connecting') {
    return 'Connecting';
  }

  return 'Disconnected';
}

function getExecutionStatusLabel(serverStatus: ServerStatusSnapshot): string {
  if (serverStatus.fetchState === 'loading' || serverStatus.fetchState === 'idle') {
    return 'Checking execution';
  }

  if (serverStatus.fetchState === 'error') {
    return 'Execution unknown';
  }

  if (serverStatus.info.executionAllowed === false) {
    return 'Execution disabled';
  }

  return 'Execution available';
}

function getExecutionStatusDetail(serverStatus: ServerStatusSnapshot): string {
  if (serverStatus.fetchState === 'loading' || serverStatus.fetchState === 'idle') {
    return 'Waiting for the backend status check to report execution support.';
  }

  if (serverStatus.fetchState === 'error') {
    return 'The execution server could not be reached, so runtime availability could not be verified.';
  }

  if (serverStatus.info.executionAllowed === false) {
    return 'This backend is reachable, but browser-triggered Java and Python execution is currently disabled.';
  }

  if (serverStatus.info.executionSandboxStatus) {
    return `Execution is enabled. Isolation mode: ${serverStatus.info.executionSandboxStatus}.`;
  }

  return 'Execution is enabled on this backend.';
}

function formatCheckedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HelpCircleIcon, CloseIcon } from './Icons';
import ModalOverlay from './ModalOverlay';
import GetInvolvedActions from './GetInvolvedActions';

interface HelpModalProps {
  onClose: () => void;
}

interface ServerInfoState {
  status: 'idle' | 'loading' | 'success' | 'error';
  javaAvailable: boolean | null;
  javaVersion: string | null;
  pythonAvailable: boolean | null;
  pythonVersion: string | null;
}

const shortcuts: { keys: string; desc: string }[] = [
  { keys: 'Ctrl + Enter', desc: 'Run code' },
  { keys: 'Ctrl + S', desc: 'Download current file' },
  { keys: 'Ctrl + Shift + S', desc: 'Download workspace as .zip' },
  { keys: 'Ctrl + Shift + F', desc: 'Search workspace' },
  { keys: 'Alt + N', desc: 'New file' },
  { keys: 'Alt + Shift + N', desc: 'New folder' },
  { keys: 'Alt + Shift + F', desc: 'Format document' },
  { keys: 'Ctrl + B', desc: 'Toggle file explorer' },
  { keys: 'Ctrl + `', desc: 'Toggle terminal' },
  { keys: 'Up / Down', desc: 'Terminal command history' },
];

const tips: Array<{ title: string; items: string[] }> = [
  {
    title: 'Starting Rooms',
    items: [
      'Share the URL to invite collaborators instantly.',
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
    ],
  },
];

type Tab = 'about' | 'shortcuts' | 'tips' | 'involved';

export default function HelpModal({ onClose }: HelpModalProps) {
  const [tab, setTab] = useState<Tab>('about');
  const [serverInfo, setServerInfo] = useState<ServerInfoState>({
    status: 'idle',
    javaAvailable: null,
    javaVersion: null,
    pythonAvailable: null,
    pythonVersion: null,
  });
  const serverInfoRef = useRef(serverInfo);

  useEffect(() => {
    serverInfoRef.current = serverInfo;
  }, [serverInfo]);

  useEffect(() => {
    if (tab !== 'about' || serverInfoRef.current.status !== 'idle') {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 8000);
    setServerInfo((current) => ({ ...current, status: 'loading' }));

    void fetchServerInfo(controller.signal)
      .then(async (response) => {
        setServerInfo({
          status: 'success',
          javaAvailable: response.javaAvailable === true,
          javaVersion: typeof response.javaVersion === 'string' ? response.javaVersion : null,
          pythonAvailable: response.pythonAvailable === true,
          pythonVersion: typeof response.pythonVersion === 'string' ? response.pythonVersion : null,
        });
      })
      .catch(() => {
        setServerInfo({
          status: 'error',
          javaAvailable: null,
          javaVersion: null,
          pythonAvailable: null,
          pythonVersion: null,
        });
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [tab]);

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cc-card flex h-[35rem] max-h-[85vh] w-[460px] max-w-[92vw] flex-col overflow-hidden rounded-lg">
        <div className="cc-divider border-b px-4 pt-3 sm:px-5 sm:pt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="cc-text-primary flex items-center gap-2 text-sm font-semibold">
              <HelpCircleIcon className="h-4 w-4 text-[var(--cc-accent)]" strokeWidth={2} />
              Help
            </h2>
            <button
              onClick={onClose}
              className="cc-icon-button -m-1 cursor-pointer p-1"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
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
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 py-2.5 sm:px-5 sm:py-3"
          style={{ scrollbarGutter: 'stable' }}
        >
          {tab === 'about' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center pt-1 text-center">
                <img
                  src="/collab-code/logo.svg"
                  alt="Collab Code"
                  className="mb-3 h-16 w-16 sm:h-20 sm:w-20"
                />
                <h3 className="cc-text-primary text-sm font-semibold">Collab Code</h3>
                <p className="cc-text-muted mt-2 max-w-[360px] text-xs leading-relaxed">
                  Collaborative coding rooms for classrooms, tutoring sessions, and pair programming.
                  Share a room link, edit the same workspace, use one shared terminal session, and run
                  Java and Python together from the browser. New rooms can start with a Java starter,
                  a Python starter, or a blank workspace.
                </p>
              </div>

              <div className="grid gap-2.5">
                <InfoCard label="Server Java Runtime">
                  <ServerRuntimeVersion
                    status={serverInfo.status}
                    available={serverInfo.javaAvailable}
                    version={serverInfo.javaVersion}
                    label="Java"
                  />
                </InfoCard>
                <InfoCard label="Server Python Runtime">
                  <ServerRuntimeVersion
                    status={serverInfo.status}
                    available={serverInfo.pythonAvailable}
                    version={serverInfo.pythonVersion}
                    label="Python"
                  />
                </InfoCard>
              </div>
            </div>
          )}

          {tab === 'shortcuts' && (
            <div className="grid min-h-full content-center gap-2 sm:grid-cols-2">
              {shortcuts.map((shortcut) => (
                <ShortcutCard key={shortcut.keys} shortcut={shortcut} />
              ))}
            </div>
          )}

          {tab === 'tips' && (
            <div className="grid min-h-full content-center gap-2.5">
              {tips.map((section) => (
                <TipSection key={section.title} title={section.title} items={section.items} />
              ))}
            </div>
          )}

          {tab === 'involved' && (
            <div className="flex min-h-full flex-col items-center justify-center">
              <div className="cc-text-muted mb-1.5 text-center text-xs">
                <span className="font-semibold text-pink-400">Get Involved</span> - Support, suggest, or contribute.
              </div>
              <p className="cc-text-muted mb-4 max-w-[360px] text-center text-[11px] leading-snug">
                Sponsor to support ongoing development, open an issue for bugs or ideas, and star the repo
                or send a PR if you would like to contribute.
              </p>
              <GetInvolvedActions />
            </div>
          )}
        </div>

        <div className="cc-divider flex flex-col items-center gap-1 border-t px-4 py-2 sm:gap-1.5 sm:px-5 sm:py-2.5">
          <div className="cc-text-muted font-mono text-xs">v{__APP_VERSION__}</div>
          <span className="cc-text-muted text-xs">
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
      className={`cursor-pointer border-b-2 pb-2 text-xs font-medium transition-colors ${
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
    <div className="cc-panel rounded-lg border px-3 py-2.5">
      <div className="cc-section-label mb-1.5 text-[10px] font-semibold">
        {label}
      </div>
      <div className="cc-text-secondary text-xs">{children}</div>
    </div>
  );
}

function ShortcutCard({
  shortcut,
}: {
  shortcut: { keys: string; desc: string };
}) {
  return (
    <div className="cc-panel flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="cc-text-primary min-w-0 text-[11px] font-medium leading-snug">{shortcut.desc}</div>
      <kbd className="cc-kbd shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono">
        {shortcut.keys}
      </kbd>
    </div>
  );
}

function TipSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="cc-panel rounded-lg border px-3 py-2.5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">
        {title}
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2">
            <div className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cc-accent)] opacity-70" />
            <p className="cc-text-secondary text-[11px] leading-snug">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServerRuntimeVersion({
  status,
  available,
  version,
  label,
}: {
  status: ServerInfoState['status'];
  available: boolean | null;
  version: string | null;
  label: string;
}) {
  if (status === 'loading' || status === 'idle') {
    return <span className="cc-text-muted">Checking execution server...</span>;
  }

  if (status === 'error') {
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

function getServerInfoUrl(): string {
  const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4444';
  const url = new URL(wsUrl, window.location.href);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function fetchServerInfo(signal: AbortSignal): Promise<{
  javaAvailable?: boolean;
  javaVersion?: string | null;
  pythonAvailable?: boolean;
  pythonVersion?: string | null;
}> {
  const candidates = getServerInfoUrls();
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      return await response.json() as {
        javaAvailable?: boolean;
        javaVersion?: string | null;
        pythonAvailable?: boolean;
        pythonVersion?: string | null;
      };
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to reach execution server');
}

function getServerInfoUrls(): string[] {
  const primary = getServerInfoUrl();
  const urls = new Set<string>([primary]);
  const primaryUrl = new URL(primary);
  const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);
  const shouldTryLocalFallbacks = localHostnames.has(primaryUrl.hostname) || localHostnames.has(window.location.hostname);

  if (shouldTryLocalFallbacks) {
    urls.add('http://localhost:4444/');
    urls.add('http://127.0.0.1:4444/');
  }

  return [...urls];
}

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
        if (controller.signal.aborted) {
          setServerInfo({
            status: 'error',
            javaAvailable: null,
            javaVersion: null,
            pythonAvailable: null,
            pythonVersion: null,
          });
          return;
        }

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
      <div className="bg-[#1e2030] border border-zinc-700 rounded-lg shadow-2xl shadow-black/60 w-[460px] max-w-[92vw] h-[35rem] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 pt-3 sm:pt-4 border-b border-zinc-700/60">
          <div className="flex items-center justify-between mb-2.5">
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
          <div className="flex flex-wrap gap-3">
            <TabButton
              active={tab === 'about'}
              activeClassName="text-sky-400 border-sky-400"
              inactiveClassName="text-zinc-500 border-transparent hover:text-zinc-300"
              onClick={() => setTab('about')}
            >
              About
            </TabButton>
            <TabButton
              active={tab === 'shortcuts'}
              activeClassName="text-emerald-400 border-emerald-400"
              inactiveClassName="text-zinc-500 border-transparent hover:text-zinc-300"
              onClick={() => setTab('shortcuts')}
            >
              Shortcuts
            </TabButton>
            <TabButton
              active={tab === 'tips'}
              activeClassName="text-emerald-400 border-emerald-400"
              inactiveClassName="text-zinc-500 border-transparent hover:text-zinc-300"
              onClick={() => setTab('tips')}
            >
              Tips
            </TabButton>
            <TabButton
              active={tab === 'involved'}
              activeClassName="text-pink-400 border-pink-400"
              inactiveClassName="text-zinc-500 border-transparent hover:text-pink-300"
              onClick={() => setTab('involved')}
            >
              Get Involved
            </TabButton>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-2.5 sm:py-3"
          style={{ scrollbarGutter: 'stable' }}
        >
          {tab === 'about' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center pt-1">
                <img
                  src="/collab-code/logo.svg"
                  alt="Collab Code"
                  className="w-16 h-16 sm:w-20 sm:h-20 mb-3"
                />
                <h3 className="text-sm font-semibold text-zinc-100">Collab Code</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400 max-w-[360px]">
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
              <div className="mb-1.5 text-xs text-zinc-400 text-center">
                <span className="font-semibold text-pink-400">Get Involved</span> - Support, suggest, or contribute.
              </div>
              <p className="mb-4 text-[11px] leading-snug text-zinc-400/90 text-center max-w-[360px]">
                Sponsor to support ongoing development, open an issue for bugs or ideas, and star the repo
                or send a PR if you would like to contribute.
              </p>
              <GetInvolvedActions />
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 py-2 sm:py-2.5 border-t border-zinc-700/60 flex flex-col items-center gap-1 sm:gap-1.5">
          <div className="text-xs text-zinc-400 font-mono">v{__APP_VERSION__}</div>
          <span className="text-xs text-zinc-400">
            Made with <span className="text-red-400">♥</span> by{' '}
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
      className={`pb-2 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
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
    <div className="rounded-lg border border-zinc-700/80 bg-[#161b22] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
        {label}
      </div>
      <div className="text-xs text-zinc-300">{children}</div>
    </div>
  );
}

function ShortcutCard({
  shortcut,
}: {
  shortcut: { keys: string; desc: string };
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-700/80 bg-[#161b22] px-3 py-2">
      <div className="min-w-0 text-[11px] font-medium leading-snug text-zinc-200">{shortcut.desc}</div>
      <kbd className="shrink-0 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
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
    <div className="rounded-lg border border-zinc-700/80 bg-[#161b22] px-3 py-2.5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
        {title}
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2">
            <div className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
            <p className="text-[11px] leading-snug text-zinc-300">{item}</p>
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
    return <span className="text-zinc-400">Checking execution server...</span>;
  }

  if (status === 'error') {
    return <span className="text-amber-300">Unable to reach the execution server.</span>;
  }

  if (!available) {
    return <span className="text-amber-300">{label} is not available on this server.</span>;
  }

  if (!version) {
    return <span className="font-mono text-zinc-100">{label} available</span>;
  }

  return <span className="font-mono text-zinc-100 break-all">{version}</span>;
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

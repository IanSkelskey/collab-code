import { useEffect, useRef, useState, type ReactNode } from 'react';
import { primaryLanguage } from '../config/languages';
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

const tips: string[] = [
  'Share the URL to invite collaborators - they join instantly.',
  'Drag files onto folders in the explorer to move them.',
  'Right-click files and folders for rename, delete, and more.',
  'Deleted files show an undo toast - click it within 5 seconds to restore.',
  'Use the terminal for quick file operations: ls, cd, mkdir, touch, rm, mv, cat.',
  `${primaryLanguage.label} files can be run directly with Ctrl+Enter or the Run button.`,
];

type Tab = 'about' | 'shortcuts' | 'tips' | 'involved';

export default function HelpModal({ onClose }: HelpModalProps) {
  const [tab, setTab] = useState<Tab>('shortcuts');
  const [serverInfo, setServerInfo] = useState<ServerInfoState>({
    status: 'idle',
    javaAvailable: null,
    javaVersion: null,
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
        });
      })
      .catch(() => {
        if (controller.signal.aborted) {
          setServerInfo({
            status: 'error',
            javaAvailable: null,
            javaVersion: null,
          });
          return;
        }

        setServerInfo({
          status: 'error',
          javaAvailable: null,
          javaVersion: null,
        });
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [tab]);

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-[#1e2030] border border-zinc-700 rounded-lg shadow-2xl shadow-black/60 w-[460px] max-w-[92vw] h-[34rem] max-h-[85vh] flex flex-col overflow-hidden">
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
          <div className="flex flex-wrap gap-4">
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
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3 sm:py-4"
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
                  Java together from the browser.
                </p>
              </div>

              <div className="grid gap-2.5">
                <InfoCard label="App Version">
                  <span className="font-mono text-zinc-100">v{__APP_VERSION__}</span>
                </InfoCard>
                <InfoCard label="Server Java Runtime">
                  <ServerJavaVersion serverInfo={serverInfo} />
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
            <div className="grid min-h-full content-center gap-2 sm:grid-cols-2">
              {tips.map((tip, index) => (
                <TipCard key={tip} index={index} tip={tip} />
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

        <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-t border-zinc-700/60 flex flex-col items-center gap-1.5 sm:gap-2">
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

function TipCard({
  index,
  tip,
}: {
  index: number;
  tip: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-zinc-700/80 bg-[#161b22] px-3 py-2.5">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-[10px] font-semibold text-emerald-300">
        {index + 1}
      </div>
      <p className="text-[11px] leading-snug text-zinc-300">{tip}</p>
    </div>
  );
}

function ServerJavaVersion({ serverInfo }: { serverInfo: ServerInfoState }) {
  if (serverInfo.status === 'loading' || serverInfo.status === 'idle') {
    return <span className="text-zinc-400">Checking execution server...</span>;
  }

  if (serverInfo.status === 'error') {
    return <span className="text-amber-300">Unable to reach the execution server.</span>;
  }

  if (!serverInfo.javaAvailable) {
    return <span className="text-amber-300">Java is not available on this server.</span>;
  }

  if (!serverInfo.javaVersion) {
    return <span className="font-mono text-zinc-100">Java available</span>;
  }

  return <span className="font-mono text-zinc-100 break-all">{serverInfo.javaVersion}</span>;
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

import { useState, useCallback } from 'react';
import { UsersIcon, TerminalIcon, MonitorIcon } from './Icons';
import GetInvolvedActions from './GetInvolvedActions';
import RoomTemplateDialog from './RoomTemplateDialog';
import ThemePicker from './ThemePicker';
import type { RoomTemplateId } from '../config/roomTemplates';

function generateRoomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
}

interface LandingPageProps {
  onCreateRoom: (roomId: string, templateId: RoomTemplateId) => void;
  onJoinRoom: (roomId: string) => void;
}

export default function LandingPage({ onCreateRoom, onJoinRoom }: LandingPageProps) {
  const [joinId, setJoinId] = useState('');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const handleCreate = useCallback(() => {
    setTemplateDialogOpen(true);
  }, []);

  const handleTemplateSelect = useCallback((templateId: RoomTemplateId) => {
    setTemplateDialogOpen(false);
    onCreateRoom(generateRoomId(), templateId);
  }, [onCreateRoom]);

  const handleJoin = useCallback(() => {
    const trimmed = joinId.trim().replace(/^#/, '');
    if (trimmed) onJoinRoom(trimmed);
  }, [joinId, onJoinRoom]);

  return (
    <div className="cc-app-shell flex h-[100dvh] w-screen flex-col overflow-auto">
      <header className="cc-topbar cc-divider flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <img src="/collab-code/logo.svg" alt="Collab Code" className="w-7 h-7" />
          <h1 className="text-base font-semibold tracking-tight">
            <span className="cc-text-primary">Collab Code</span>
            <span className="cc-text-muted ml-1.5 font-mono text-xs font-normal">v{__APP_VERSION__}</span>
          </h1>
        </div>

        <ThemePicker compact />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl flex flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <img
              src="/collab-code/logo.svg"
              alt="Collab Code"
              className="w-20 h-20 sm:w-24 sm:h-24"
            />
            <h2 className="cc-text-primary text-2xl font-bold tracking-tight sm:text-3xl">
              Collab Code
            </h2>
            <span className="cc-text-faint -mt-2 font-mono text-xs">v{__APP_VERSION__}</span>
            <p className="cc-text-muted max-w-lg text-sm leading-relaxed sm:text-base">
              A minimal, collaborative coding room for Java and Python, built for tutors and students.
              No installs, no accounts - just share a link and start coding together in real time.
            </p>
            <p className="cc-text-faint text-center text-xs italic">
              Creating a room opens a starter picker for Java, Python, or a blank workspace.
            </p>
          </div>

          <div className="w-full max-w-xs flex flex-col gap-4">
            <button
              onClick={handleCreate}
              className="cc-button-primary w-full cursor-pointer rounded-lg px-5 py-3 text-sm font-semibold"
            >
              Create a Room
            </button>

            <p className="cc-text-faint text-center text-[11px] leading-relaxed">
              You&apos;ll choose the room starter after clicking create.
            </p>

            <div className="flex items-center gap-3">
              <div className="cc-divider flex-1 border-t" />
              <span className="cc-section-label text-xs">or join</span>
              <div className="cc-divider flex-1 border-t" />
            </div>

            <form
              onSubmit={(event) => { event.preventDefault(); handleJoin(); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={joinId}
                onChange={(event) => setJoinId(event.target.value)}
                placeholder="Room code"
                className="cc-input-shell cc-input flex-1 min-w-0 rounded-lg px-3 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!joinId.trim()}
                className="cc-button-secondary cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Join
              </button>
            </form>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center w-full max-w-sm pt-2">
            <div className="flex flex-col items-center gap-1.5">
              <UsersIcon className="h-5 w-5 text-[var(--cc-accent)]" />
              <span className="cc-text-faint text-[11px]">Real-time collaboration</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <TerminalIcon className="h-5 w-5 text-[var(--cc-accent)]" strokeWidth={1.5} />
              <span className="cc-text-faint text-[11px]">Run Java or Python</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <MonitorIcon className="h-5 w-5 text-[var(--cc-accent)]" />
              <span className="cc-text-faint text-[11px]">No setup needed</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-2 w-full max-w-sm">
            <div className="cc-text-muted text-center text-xs">
              <span className="font-semibold text-pink-400">Get Involved</span> - Support, suggest, or contribute!
            </div>
            <GetInvolvedActions />
          </div>
        </div>
      </main>

      <footer className="cc-topbar cc-divider flex shrink-0 flex-col items-center gap-2 border-t py-3 text-[11px]">
        <div>Built for CS educators &amp; students</div>
        <div className="cc-text-faint">
          Made with <span className="text-red-400">&#9829;</span> by{' '}
          <a
            href="https://github.com/IanSkelskey"
            target="_blank"
            rel="noopener noreferrer"
            className="cc-link underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            Ian Skelskey
          </a>
        </div>
      </footer>

      {templateDialogOpen && (
        <RoomTemplateDialog
          onSelect={handleTemplateSelect}
          onClose={() => setTemplateDialogOpen(false)}
        />
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { UsersIcon, TerminalIcon, MonitorIcon } from './Icons';
import GetInvolvedActions from './GetInvolvedActions';
import RoomTemplateDialog from './RoomTemplateDialog';
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
    <div className="h-[100dvh] w-screen flex flex-col bg-[#0d1117] text-white overflow-auto">
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 sm:px-6 bg-[#161b22] border-b border-zinc-700/50">
        <img src="/collab-code/logo.svg" alt="Collab Code" className="w-7 h-7" />
        <h1 className="text-base font-semibold tracking-tight text-zinc-100">
          Collab Code
          <span className="text-xs text-zinc-400 font-normal font-mono ml-1.5">v{__APP_VERSION__}</span>
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl flex flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <img
              src="/collab-code/logo.svg"
              alt="Collab Code"
              className="w-20 h-20 sm:w-24 sm:h-24"
            />
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              Collab Code
            </h2>
            <span className="text-xs text-zinc-500 font-mono -mt-2">v{__APP_VERSION__}</span>
            <p className="text-sm sm:text-base text-zinc-400 max-w-lg leading-relaxed">
              A minimal, collaborative coding room for Java and Python, built for tutors and students.
              No installs, no accounts - just share a link and start coding together in real time.
            </p>
            <p className="text-xs text-zinc-500 text-center italic">
              Creating a room opens a starter picker for Java, Python, or a blank workspace.
            </p>
          </div>

          <div className="w-full max-w-xs flex flex-col gap-4">
            <button
              onClick={handleCreate}
              className="w-full px-5 py-3 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors cursor-pointer"
            >
              Create a Room
            </button>

            <p className="text-center text-[11px] leading-relaxed text-zinc-500">
              You&apos;ll choose the room starter after clicking create.
            </p>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-700/60" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">or join</span>
              <div className="flex-1 h-px bg-zinc-700/60" />
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
                className="flex-1 min-w-0 px-3 py-2.5 rounded-lg text-sm bg-[#161b22] border border-zinc-700 text-zinc-200 placeholder-zinc-500 outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!joinId.trim()}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Join
              </button>
            </form>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center w-full max-w-sm pt-2">
            <div className="flex flex-col items-center gap-1.5">
              <UsersIcon className="w-5 h-5 text-emerald-400" />
              <span className="text-[11px] text-zinc-500">Real-time collaboration</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <TerminalIcon className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
              <span className="text-[11px] text-zinc-500">Run Java or Python</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <MonitorIcon className="w-5 h-5 text-emerald-400" />
              <span className="text-[11px] text-zinc-500">No setup needed</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-2 w-full max-w-sm">
            <div className="text-xs text-zinc-400 text-center">
              <span className="font-semibold text-pink-400">Get Involved</span> - Support, suggest, or contribute!
            </div>
            <GetInvolvedActions />
          </div>
        </div>
      </main>

      <footer className="shrink-0 flex flex-col items-center gap-2 py-3 text-[11px] text-zinc-600 border-t border-zinc-800/50">
        <div>Built for CS educators &amp; students</div>
        <div className="text-zinc-500">
          Made with <span className="text-red-400">&#10084;&#65039;</span> by{' '}
          <a
            href="https://github.com/IanSkelskey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-emerald-400 transition-colors underline underline-offset-2"
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

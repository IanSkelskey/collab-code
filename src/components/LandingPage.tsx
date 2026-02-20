import { useState, useCallback } from 'react';

function generateRoomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
}

interface LandingPageProps {
  onEnterRoom: (roomId: string) => void;
}

export default function LandingPage({ onEnterRoom }: LandingPageProps) {
  const [joinId, setJoinId] = useState('');

  const handleCreate = useCallback(() => {
    onEnterRoom(generateRoomId());
  }, [onEnterRoom]);

  const handleJoin = useCallback(() => {
    const trimmed = joinId.trim().replace(/^#/, '');
    if (trimmed) onEnterRoom(trimmed);
  }, [joinId, onEnterRoom]);

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-[#0d1117] text-white overflow-auto">
      {/* Minimal header */}
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 sm:px-6 bg-[#161b22] border-b border-zinc-700/50">
        <img src="/collab-code/logo.svg" alt="Collab Code" className="w-7 h-7" />
        <h1 className="text-base font-semibold tracking-tight text-zinc-100">
          Collab Code
          <span className="text-xs text-zinc-400 font-normal font-mono ml-1.5">v{__APP_VERSION__}</span>
        </h1>
      </header>

      {/* Main content — centered */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg flex flex-col items-center gap-10">
          {/* Logo + heading */}
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
            <p className="text-sm sm:text-base text-zinc-400 max-w-md leading-relaxed">
              A minimal, collaborative Java IDE built for tutors and students.
              No installs, no accounts&mdash;just share a link and start
              coding together in real time.
            </p>
            
            {/* Language note */}
            <p className="text-xs text-zinc-500 text-center italic">
                Currently only supports Java&mdash;more languages coming soon.
            </p>
          </div>

          {/* Actions */}
          <div className="w-full max-w-xs flex flex-col gap-4">
            {/* Create new room */}
            <button
              onClick={handleCreate}
              className="w-full px-5 py-3 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors cursor-pointer"
            >
              Create a Room
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-700/60" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">or join</span>
              <div className="flex-1 h-px bg-zinc-700/60" />
            </div>

            {/* Join existing room */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleJoin(); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
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

          {/* Brief feature highlights */}
          <div className="grid grid-cols-3 gap-4 text-center w-full max-w-sm pt-2">
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[11px] text-zinc-500">Real-time collaboration</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="4 17 10 11 4 5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="19" x2="20" y2="19" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[11px] text-zinc-500">Run code in-browser</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="8" y1="21" x2="16" y2="21" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21" strokeLinecap="round" />
              </svg>
              <span className="text-[11px] text-zinc-500">No setup needed</span>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 text-center py-3 text-[11px] text-zinc-600 border-t border-zinc-800/50 space-y-1">
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
    </div>
  );
}

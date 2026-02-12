import { useRef, useCallback, useState } from 'react';
import { CollabProvider, useCollab } from './context/CollabContext';
import { useRoom } from './hooks/useRoom';
import Editor, { type EditorHandle } from './components/Editor';
import Terminal, { type TerminalHandle } from './components/Terminal';
import PeerAvatars from './components/PeerAvatars';
import { executeJava } from './services/pistonApi';

function AppContent() {
  const { ydoc, peerCount, roomId } = useCollab();
  const terminalRef = useRef<TerminalHandle>(null);
  const editorRef = useRef<EditorHandle>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const runningRef = useRef(false);

  const handleRun = useCallback(async () => {
    if (runningRef.current) return;

    // Read from what Monaco actually displays, not from Y.Text directly,
    // to avoid stale/corrupted IndexedDB data mismatch
    const sourceCode = editorRef.current?.getCode() ?? ydoc.getText('code').toString();
    if (!sourceCode.trim()) {
      terminalRef.current?.writeln('\x1b[33mNo code to run.\x1b[0m');
      terminalRef.current?.write('\x1b[38;2;86;182;194m$ \x1b[0m');
      return;
    }

    runningRef.current = true;
    setRunning(true);
    terminalRef.current?.writeln('\x1b[1;36m▶ Compiling & running...\x1b[0m');

    try {
      const result = await executeJava(sourceCode);

      // Show compilation errors if any
      if (result.compile && result.compile.stderr) {
        terminalRef.current?.writeln('\x1b[1;31m── Compilation Error ──\x1b[0m');
        result.compile.stderr.split('\n').forEach((line) => {
          terminalRef.current?.writeln(`\x1b[31m${line}\x1b[0m`);
        });
      }

      if (result.compile && result.compile.stdout) {
        result.compile.stdout.split('\n').forEach((line) => {
          terminalRef.current?.writeln(line);
        });
      }

      // Show runtime output
      if (result.run.stdout) {
        terminalRef.current?.writeln('\x1b[1;32m── Output ──\x1b[0m');
        result.run.stdout.split('\n').forEach((line) => {
          terminalRef.current?.writeln(line);
        });
      }

      if (result.run.stderr) {
        terminalRef.current?.writeln('\x1b[1;31m── Runtime Error ──\x1b[0m');
        result.run.stderr.split('\n').forEach((line) => {
          terminalRef.current?.writeln(`\x1b[31m${line}\x1b[0m`);
        });
      }

      if (result.run.code !== 0 && result.run.code !== null) {
        terminalRef.current?.writeln(
          `\x1b[33mProcess exited with code ${result.run.code}\x1b[0m`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      terminalRef.current?.writeln(`\x1b[31mExecution failed: ${msg}\x1b[0m`);
    } finally {
      runningRef.current = false;
      setRunning(false);
      terminalRef.current?.write('\x1b[38;2;86;182;194m$ \x1b[0m');
    }
  }, [ydoc]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}#${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
      prompt('Share this link:', url);
    }
  }, [roomId]);

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-[#0d1117] text-white overflow-hidden">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 bg-[#161b22] border-b border-zinc-700/50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Logo / Title */}
          <h1 className="text-sm sm:text-base font-semibold tracking-tight">
            <span className="text-emerald-400">&lt;/&gt;</span>{' '}
            <span className="text-zinc-100 hidden xs:inline">Collab Code</span>
          </h1>

          <div className="w-px h-5 bg-zinc-700 hidden sm:block" />

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer touch-manipulation"
          >
            {running ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            <span className="hidden sm:inline">{running ? 'Running...' : 'Run'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Peer count + avatars */}
          <PeerAvatars />
          <span className="text-xs text-zinc-400 hidden sm:inline">
            {peerCount} {peerCount === 1 ? 'peer' : 'peers'}
          </span>

          <div className="w-px h-5 bg-zinc-700 hidden sm:block" />

          {/* Room ID */}
          <span className="text-xs text-zinc-500 font-mono hidden md:inline">
            #{roomId}
          </span>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 transition-colors cursor-pointer touch-manipulation"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </header>

      {/* Main content: Editor + Terminal */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Editor — takes more space on larger screens */}
        <div className="flex-1 sm:flex-[3] min-h-[120px] sm:min-h-0">
          <Editor ref={editorRef} />
        </div>

        {/* Divider */}
        <div className="h-[2px] sm:h-px bg-zinc-600 sm:bg-zinc-700/50 shrink-0" />

        {/* Terminal */}
        <div className="flex-1 sm:flex-[2] min-h-[100px] sm:min-h-0 bg-[#1a1a2e]">
          <Terminal ref={terminalRef} onRunRequested={handleRun} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const roomId = useRoom();

  return (
    <CollabProvider roomId={roomId}>
      <AppContent />
    </CollabProvider>
  );
}

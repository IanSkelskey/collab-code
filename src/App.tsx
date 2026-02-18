import { useRef, useCallback, useState, useEffect } from 'react';
import { CollabProvider, useCollab } from './context/CollabContext';
import { useRoom } from './hooks/useRoom';
import { useVirtualFS } from './hooks/useVirtualFS';
import Editor, { type EditorHandle } from './components/Editor';
import Terminal, { type TerminalHandle } from './components/Terminal';
import FileExplorer from './components/FileExplorer';
import PeerAvatars from './components/PeerAvatars';
import { InteractiveExecutor } from './services/interactiveExec';
import { parseJavaDiagnostics, parseJavaRuntimeErrors } from './services/javaDiagnostics';

function AppContent() {
  const { ydoc, peerCount, roomId, connected } = useCollab();
  const fs = useVirtualFS(ydoc);
  const terminalRef = useRef<TerminalHandle>(null);
  const editorRef = useRef<EditorHandle>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [fontSize, setFontSize] = useState(window.innerWidth < 640 ? 12 : 14);
  const runningRef = useRef(false);
  const executorRef = useRef<InteractiveExecutor | null>(null);
  const [explorerVisible, setExplorerVisible] = useState(() => window.innerWidth >= 768);
  const [explorerWidth, setExplorerWidth] = useState(() =>
    window.innerWidth < 640 ? 160 : 200
  );

  // Terminal panel state
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Interactive execution via WebSocket — runs Java on the server with
  // real-time stdin/stdout/stderr streaming, just like a real IDE.
  const handleRun = useCallback(() => {
    if (runningRef.current) return;

    // Send all project files to the server for multi-file compilation
    const allFiles = fs.getAllFiles();
    const fileNames = Object.keys(allFiles);
    if (fileNames.length === 0 || fileNames.every(f => !allFiles[f].trim())) {
      terminalRef.current?.writeln('\x1b[33mNo code to run.\x1b[0m');
      return;
    }

    // Auto-show terminal
    setTerminalVisible(true);

    // Kill any previous execution
    if (executorRef.current) {
      executorRef.current.close();
      executorRef.current = null;
    }

    runningRef.current = true;
    setRunning(true);
    editorRef.current?.clearMarkers();

    // Accumulated stderr for diagnostics parsing at exit
    let compileOutput = '';
    let runtimeStderr = '';

    const executor = new InteractiveExecutor();
    executorRef.current = executor;

    const finish = () => {
      runningRef.current = false;
      setRunning(false);
      terminalRef.current?.exitExecMode();
      executorRef.current = null;
    };

    executor.execute(allFiles, {
      onCompileStart() {
        terminalRef.current?.writeln('\x1b[1;36m▶ Compiling...\x1b[0m');
      },

      onCompileError(data) {
        compileOutput = data;
        terminalRef.current?.writeln('\x1b[1;31m── Compilation Error ──\x1b[0m');
        data.split('\n').forEach((line) => {
          terminalRef.current?.writeln(`\x1b[31m${line}\x1b[0m`);
        });

        // Set inline diagnostics in the editor (filter to active file)
        const allMarkers = parseJavaDiagnostics(compileOutput);
        const activeFileName = fs.activeFile?.split('/').pop();
        const markers = activeFileName
          ? allMarkers.filter(m => !m.file || m.file === activeFileName)
          : allMarkers;
        if (markers.length > 0) editorRef.current?.setMarkers(markers);

        finish();
      },

      onCompileOk() {
        terminalRef.current?.writeln('\x1b[1;32m── Running ──\x1b[0m');

        // Enter interactive execution mode — stdin typed in the terminal
        // is forwarded to the running Java process in real time.
        terminalRef.current?.enterExecMode(
          (data) => executor.sendStdin(data),
          () => executor.kill(),
        );
      },

      onStdout(data) {
        terminalRef.current?.write(data);
      },

      onStderr(data) {
        runtimeStderr += data;
        terminalRef.current?.write(`\x1b[31m${data}\x1b[0m`);
      },

      onExit(code) {
        if (code !== 0 && code !== null) {
          terminalRef.current?.writeln(
            `\n\x1b[33mProcess exited with code ${code}\x1b[0m`
          );
        } else {
          terminalRef.current?.writeln('');
        }

        // Set runtime error markers if any (filter to active file)
        const allRtMarkers = parseJavaRuntimeErrors(runtimeStderr);
        const activeRtFile = fs.activeFile?.split('/').pop();
        const rtMarkers = activeRtFile
          ? allRtMarkers.filter(m => !m.file || m.file === activeRtFile)
          : allRtMarkers;
        if (rtMarkers.length > 0) editorRef.current?.setMarkers(rtMarkers);

        finish();
      },

      onError(error) {
        terminalRef.current?.writeln(`\x1b[31mExecution failed: ${error}\x1b[0m`);
        finish();
      },
    });
  }, [fs]);

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

  const handleCopyCode = useCallback(async () => {
    const code = editorRef.current?.getCode() ?? '';
    if (!code.trim()) return;
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      prompt('Copy this code:', code);
    }
  }, []);

  const handleSaveFile = useCallback(() => {
    const code = editorRef.current?.getCode() ?? '';
    if (!code.trim()) return;
    const blob = new Blob([code], { type: 'text/x-java' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Use active filename or default to Main.java
    const activeName = fs.activeFile?.split('/').pop() ?? 'Main.java';
    a.download = activeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [fs.activeFile]);

  const handleToggleTerminal = useCallback(() => {
    setTerminalVisible((v) => !v);
  }, []);

  const handleFontSizeUp = useCallback(() => {
    setFontSize((s) => Math.min(s + 2, 28));
  }, []);

  const handleFontSizeDown = useCallback(() => {
    setFontSize((s) => Math.max(s - 2, 8));
  }, []);

  const handleToggleExplorer = useCallback(() => {
    setExplorerVisible((v) => !v);
  }, []);

  // Ctrl+B keyboard shortcut to toggle explorer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setExplorerVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Drag-to-resize explorer panel
  const handleExplorerDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startWidth = explorerWidth;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
      const delta = clientX - startX;
      setExplorerWidth(Math.max(120, Math.min(400, startWidth + delta)));
    };

    const onEnd = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }, [explorerWidth]);

  // Drag-to-resize terminal panel
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startHeight = terminalHeight;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const clientY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
      const delta = startY - clientY;
      const container = containerRef.current;
      const maxHeight = container ? container.clientHeight - 120 : 600;
      setTerminalHeight(Math.max(80, Math.min(maxHeight, startHeight + delta)));
    };

    const onEnd = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }, [terminalHeight]);

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
            title="Run code (Ctrl+Enter)"
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

          <div className="w-px h-5 bg-zinc-700 hidden sm:block" />

          {/* Copy code button */}
          <button
            onClick={handleCopyCode}
            title="Copy code to clipboard"
            className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-md text-sm font-medium bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 transition-colors cursor-pointer touch-manipulation"
          >
            {codeCopied ? (
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
            <span className="hidden sm:inline">{codeCopied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* Save file button */}
          <button
            onClick={handleSaveFile}
            title="Save code to file"
            className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-md text-sm font-medium bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 transition-colors cursor-pointer touch-manipulation"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Save</span>
          </button>

          <div className="w-px h-5 bg-zinc-700 hidden sm:block" />

          {/* Font size controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleFontSizeDown}
              title="Decrease font size"
              className="px-1.5 py-1.5 rounded text-xs font-bold bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 transition-colors cursor-pointer touch-manipulation leading-none"
            >
              A−
            </button>
            <button
              onClick={handleFontSizeUp}
              title="Increase font size"
              className="px-1.5 py-1.5 rounded text-sm font-bold bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 transition-colors cursor-pointer touch-manipulation leading-none"
            >
              A+
            </button>
          </div>

        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Peer count + avatars */}
          <PeerAvatars />

          {/* Connection status dot */}
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

      {/* Main content: Activity bar + Explorer + Editor + Terminal */}
      <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
        {/* Top section: Activity bar + Explorer + Editor side by side */}
        <div className="flex-1 flex min-h-[120px]">
          {/* Activity bar — thin icon strip */}
          <div className="shrink-0 w-10 bg-[#0d1117] border-r border-zinc-700/50 flex flex-col items-center pt-1">
            <button
              onClick={handleToggleExplorer}
              title={`Toggle Explorer (Ctrl+B)`}
              className={`p-2 rounded transition-colors cursor-pointer ${
                explorerVisible
                  ? 'text-white bg-zinc-700/50'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H11L9 5H5C3.9 5 3 5.9 3 7Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* File Explorer */}
          {explorerVisible && (
            <>
              <div style={{ width: explorerWidth }} className="shrink-0 overflow-hidden">
                <FileExplorer fs={fs} />
              </div>
              {/* Explorer resize handle */}
              <div
                onMouseDown={handleExplorerDragStart}
                onTouchStart={handleExplorerDragStart}
                className="w-[3px] shrink-0 cursor-col-resize bg-zinc-700/50 hover:bg-emerald-400 transition-colors"
              />
            </>
          )}

          {/* Editor — fills remaining space */}
          <div className="flex-1 min-w-0">
            <Editor ref={editorRef} onRun={handleRun} fontSize={fontSize} fs={fs} />
          </div>
        </div>

        {/* Terminal bar — always visible, acts as toggle + drag handle */}
        <div className="shrink-0 bg-[#161b22] border-t border-zinc-700/50 flex items-center">
          {/* Toggle button */}
          <button
            onClick={handleToggleTerminal}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer touch-manipulation"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="19" x2="20" y2="19" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Terminal
            <svg
              className={`w-3 h-3 transition-transform ${terminalVisible ? 'rotate-0' : 'rotate-180'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Drag handle — only interactive when terminal is visible */}
          {terminalVisible && (
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="flex-1 h-full cursor-row-resize flex items-center justify-center group py-1"
            >
              <div className="w-10 h-[2px] bg-zinc-600 group-hover:bg-emerald-400 rounded-full transition-colors" />
            </div>
          )}
        </div>

        {/* Terminal panel */}
        {terminalVisible && (
          <div
            style={{ height: terminalHeight }}
            className="shrink-0 bg-[#1a1a2e] overflow-hidden"
          >
            <Terminal ref={terminalRef} onRunRequested={handleRun} fontSize={Math.max(fontSize - 1, 10)} fs={fs} />
          </div>
        )}
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

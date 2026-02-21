import { useRef, useCallback, useState, useEffect } from 'react';
import { CollabProvider, useCollab } from './context/CollabContext';
import { useRoom } from './hooks/useRoom';
import { useVirtualFS } from './hooks/useVirtualFS';
import { useExecution } from './hooks/useExecution';
import { useDragResize } from './hooks/useDragResize';
import { useFileExport } from './hooks/useFileExport';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { TerminalIcon, ChevronDownIcon } from './components/Icons';
import Editor, { type EditorHandle } from './components/Editor';
import Terminal, { type TerminalHandle } from './components/Terminal';
import FileExplorer from './components/FileExplorer';
import TabBar from './components/TabBar';
import Toolbar, { ActivityBar } from './components/Toolbar';
import ConfirmDialog from './components/ConfirmDialog';
import UndoToastContainer, { useUndoToast } from './components/UndoToast';
import HelpModal from './components/HelpModal';
import LandingPage from './components/LandingPage';
import { getLanguageForFile } from './config/languages';

function AppContent({ onExitRoom }: { onExitRoom: () => void }) {
  const { ydoc, peerCount, roomId, connected, awareness } = useCollab();
  const fs = useVirtualFS(ydoc);
  const terminalRef = useRef<TerminalHandle>(null);
  const editorRef = useRef<EditorHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [fontSize, setFontSize] = useState(window.innerWidth < 640 ? 12 : 14);
  const [explorerVisible, setExplorerVisible] = useState(() => window.innerWidth >= 768);
  const [explorerWidth, setExplorerWidth] = useState(() =>
    window.innerWidth < 640 ? 160 : 200
  );
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [helpOpen, setHelpOpen] = useState(false);

  // Undo toast + confirm dialog state
  const { toasts, pushToast, dismissToast } = useUndoToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    secondaryLabel?: string;
    onConfirm: () => void;
    onSecondary?: () => void;
  } | null>(null);

  const requestConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => {
      setConfirmDialog({ title, message, onConfirm, confirmLabel });
    },
    []
  );

  // Execution
  const { running, entryPoints, handleRun } = useExecution({
    fs,
    terminalRef,
    editorRef,
    setTerminalVisible,
  });

  // File export / download / clipboard
  const { codeCopied, handleCopyCode, handleSaveFile, handleSaveAll } = useFileExport({
    fs,
    roomId,
    editorRef,
    pushToast,
  });

  // Drag-to-resize panels
  const { onDragStart: handleExplorerDragStart } = useDragResize({
    axis: 'horizontal',
    value: explorerWidth,
    setValue: setExplorerWidth,
    min: 120,
    max: 400,
  });

  const { onDragStart: handleTerminalDragStart } = useDragResize({
    axis: 'vertical',
    value: terminalHeight,
    setValue: setTerminalHeight,
    min: 80,
    max: () => (containerRef.current?.clientHeight ?? 720) - 120,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    setExplorerVisible,
    setTerminalVisible,
    handleSaveFile,
    handleSaveAll,
  });

  // Warn before tab close while in a room (skip in dev for HMR)
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Broadcast active file to peers via awareness
  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField('activeFile', fs.activeFile);
  }, [awareness, fs.activeFile]);

  const handleFormat = useCallback(() => {
    editorRef.current?.format();
    pushToast('Document formatted');
  }, [pushToast]);

  const handleToggleExplorer = useCallback(() => setExplorerVisible(v => !v), []);
  const handleToggleTerminal = useCallback(() => setTerminalVisible(v => !v), []);

  const handleFontSizeUp = useCallback(() => {
    setFontSize(s => { const next = Math.min(s + 2, 28); pushToast(`Font size: ${next}`); return next; });
  }, [pushToast]);

  const handleFontSizeDown = useCallback(() => {
    setFontSize(s => { const next = Math.max(s - 2, 8); pushToast(`Font size: ${next}`); return next; });
  }, [pushToast]);

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-[#0d1117] text-white overflow-hidden">
      {/* Top header toolbar */}
      <Toolbar
        roomId={roomId}
        connected={connected}
        peerCount={peerCount}
        running={running}
        onRun={() => handleRun()}
        onExitRoom={onExitRoom}
        onSaveAll={handleSaveAll}
        onConfirmLeave={(opts) => setConfirmDialog(opts)}
      />

      {/* Main content: Activity bar + Explorer | Editor + Terminal */}
      <div ref={containerRef} className="flex-1 flex min-h-0">
        {/* Activity bar */}
        <ActivityBar
          explorerVisible={explorerVisible}
          codeCopied={codeCopied}
          fontSize={fontSize}
          activeFileName={fs.activeFile?.split('/').pop() ?? null}
          onToggleExplorer={handleToggleExplorer}
          onFormat={handleFormat}
          onCopyCode={handleCopyCode}
          onSaveFile={handleSaveFile}
          onSaveAll={handleSaveAll}
          onFontSizeUp={handleFontSizeUp}
          onFontSizeDown={handleFontSizeDown}
          onHelpOpen={() => setHelpOpen(true)}
        />

        {/* File Explorer — full height */}
        {explorerVisible && (
          <>
            <div style={{ width: explorerWidth }} className="shrink-0 overflow-hidden">
              <FileExplorer
                fs={fs}
                pushToast={pushToast}
                requestConfirm={requestConfirm}
                entryPoints={entryPoints}
                onRunFile={(filePath) => {
                  const lang = getLanguageForFile(filePath);
                  const className = lang?.extractEntryPointName?.(filePath) ?? filePath.split('/').pop()!;
                  handleRun(className);
                }}
                running={running}
              />
            </div>
            {/* Explorer resize handle */}
            <div
              onMouseDown={handleExplorerDragStart}
              onTouchStart={handleExplorerDragStart}
              className="w-3 shrink-0 cursor-col-resize flex items-center justify-center group touch-none border-r border-zinc-700/50"
            >
              <div className="h-10 w-[2px] bg-zinc-600 group-hover:bg-emerald-400 rounded-full transition-colors" />
            </div>
          </>
        )}

        {/* Right column: TabBar + Editor + Terminal stacked */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <TabBar fs={fs} />

          {/* Editor or empty state */}
          <div className="flex-1 min-h-[120px]">
            {fs.openTabs.length > 0 ? (
              <Editor ref={editorRef} onRun={handleRun} onFormat={() => pushToast('Document formatted')} fontSize={fontSize} fs={fs} />
            ) : fs.loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500 select-none">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin" />
                <p className="text-xs text-zinc-500">Loading workspace…</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-500 select-none px-4">
                <img src="/collab-code/logo.svg" alt="Collab Code" className="w-24 h-24 opacity-40" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-zinc-400">No open editors</p>
                  <p className="text-xs text-zinc-600">
                    Open a file from the Explorer{' '}
                    <button onClick={handleToggleExplorer} className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer">(Ctrl+B)</button>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Terminal bar */}
          <div className="shrink-0 bg-[#161b22] border-t border-zinc-700/50 flex items-center">
            <button
              onClick={handleToggleTerminal}
              title="Toggle Terminal (Ctrl+`)"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer touch-manipulation"
            >
              <TerminalIcon className="w-3.5 h-3.5" strokeWidth={2} />
              Terminal
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${terminalVisible ? 'rotate-0' : 'rotate-180'}`} />
            </button>
            {terminalVisible && (
              <div
                onMouseDown={handleTerminalDragStart}
                onTouchStart={handleTerminalDragStart}
                className="flex-1 h-full cursor-row-resize flex items-center justify-center group py-1"
              >
                <div className="w-10 h-[2px] bg-zinc-600 group-hover:bg-emerald-400 rounded-full transition-colors" />
              </div>
            )}
          </div>

          {/* Terminal panel */}
          {terminalVisible && (
            <div style={{ height: terminalHeight }} className="shrink-0 bg-[#1a1a2e] overflow-hidden">
              <Terminal ref={terminalRef} onRunRequested={handleRun} fontSize={Math.max(fontSize - 1, 10)} fs={fs} pushToast={pushToast} requestConfirm={requestConfirm} />
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog overlay */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          secondaryLabel={confirmDialog.secondaryLabel}
          onSecondary={confirmDialog.onSecondary}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      <UndoToastContainer toasts={toasts} onDismiss={dismissToast} />
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

export default function App() {
  const initialRoom = useRoom();
  const [roomId, setRoomId] = useState<string | null>(initialRoom);

  const handleEnterRoom = useCallback((id: string) => {
    window.location.hash = id;
    setRoomId(id);
  }, []);

  const handleExitRoom = useCallback(() => {
    window.location.hash = '';
    setRoomId(null);
  }, []);

  if (!roomId) {
    return <LandingPage onEnterRoom={handleEnterRoom} />;
  }

  return (
    <CollabProvider roomId={roomId}>
      <AppContent onExitRoom={handleExitRoom} />
    </CollabProvider>
  );
}

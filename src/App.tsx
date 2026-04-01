import { useCallback, useEffect, useRef, useState } from 'react';
import { useCollab } from './context/CollabContext';
import { useExecution } from './hooks/useExecution';
import { useFileExport } from './hooks/useFileExport';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useRoom } from './hooks/useRoom';
import { useUndoToast } from './hooks/useUndoToast';
import { useVirtualFS } from './hooks/useVirtualFS';
import { useWorkspaceImport } from './hooks/useWorkspaceImport';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';
import { TerminalIcon, ChevronDownIcon } from './components/Icons';
import Editor, { type EditorHandle } from './components/Editor';
import Terminal, { type TerminalHandle } from './components/Terminal';
import FileExplorer from './components/FileExplorer';
import TabBar from './components/TabBar';
import Toolbar, { ActivityBar } from './components/Toolbar';
import ConfirmDialog from './components/ConfirmDialog';
import UndoToastContainer from './components/UndoToast';
import HelpModal from './components/HelpModal';
import LandingPage from './components/LandingPage';
import SearchPanel from './components/SearchPanel';
import { getLanguageForFile } from './config/languages';
import { CollabProvider } from './providers/CollabProvider';

function AppContent({
  onExitRoom,
  seedDefaultFile,
}: {
  onExitRoom: () => void;
  seedDefaultFile: boolean;
}) {
  const { ydoc, peerCount, roomId, connected, awareness, storageReady } = useCollab();
  const fs = useVirtualFS(ydoc, { storageReady, seedDefaultFile });
  const terminalRef = useRef<TerminalHandle>(null);
  const editorRef = useRef<EditorHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toasts, pushToast, dismissToast } = useUndoToast();
  const layout = useWorkspaceLayout({
    fs,
    editorRef,
    containerRef,
    pushToast,
  });

  const { running, entryPoints, handleRun } = useExecution({
    ydoc,
    fs,
    terminalRef,
    editorRef,
    setTerminalVisible: layout.setTerminalVisible,
  });

  const { codeCopied, handleCopyCode, handleSaveFile, handleSaveAll } = useFileExport({
    fs,
    roomId,
    editorRef,
    pushToast,
  });

  const { osDragActive, dragHandlers } = useWorkspaceImport({ fs, pushToast });

  const handleFormatCompleted = useCallback(() => {
    pushToast('Document formatted');
  }, [pushToast]);

  useKeyboardShortcuts({
    setExplorerVisible: layout.setExplorerVisible,
    setTerminalVisible: layout.setTerminalVisible,
    setSearchVisible: layout.setSearchVisible,
    handleSaveFile,
    handleSaveAll,
  });

  useEffect(() => {
    if (import.meta.env.DEV) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField('activeFile', fs.activeFile);
  }, [awareness, fs.activeFile]);

  return (
    <div
      className="h-[100dvh] w-screen flex flex-col bg-[#0d1117] text-white overflow-hidden"
      {...dragHandlers}
    >
      <Toolbar
        roomId={roomId}
        connected={connected}
        peerCount={peerCount}
        running={running}
        onRun={() => handleRun()}
        onExitRoom={onExitRoom}
        onSaveAll={handleSaveAll}
        onConfirmLeave={(options) => layout.setConfirmDialog(options)}
        fs={fs}
      />

      <div ref={containerRef} className="flex-1 flex min-h-0">
        <ActivityBar
          explorerVisible={layout.explorerVisible}
          searchVisible={layout.searchVisible}
          codeCopied={codeCopied}
          fontSize={layout.fontSize}
          activeFileName={fs.activeFile ? fs.activeFile.split('/').pop() ?? null : null}
          onToggleExplorer={layout.handleToggleExplorer}
          onToggleSearch={layout.handleToggleSearch}
          onFormat={layout.handleFormat}
          onCopyCode={handleCopyCode}
          onSaveFile={handleSaveFile}
          onSaveAll={handleSaveAll}
          onFontSizeUp={layout.handleFontSizeUp}
          onFontSizeDown={layout.handleFontSizeDown}
          onHelpOpen={() => layout.setHelpOpen(true)}
        />

        {(layout.explorerVisible || layout.searchVisible) && (
          <>
            <div style={{ width: layout.explorerWidth }} className="shrink-0 overflow-hidden">
              {layout.searchVisible ? (
                <SearchPanel fs={fs} onNavigateTo={layout.handleSearchNavigateTo} />
              ) : (
                <FileExplorer
                  fs={fs}
                  pushToast={pushToast}
                  requestConfirm={layout.requestConfirm}
                  entryPoints={entryPoints}
                  onRunFile={(filePath) => {
                    const language = getLanguageForFile(filePath);
                    const entryName = language?.extractEntryPointName?.(filePath) ?? filePath.split('/').pop()!;
                    handleRun(entryName);
                  }}
                  running={running}
                />
              )}
            </div>

            <div
              onMouseDown={layout.handleExplorerDragStart}
              onTouchStart={layout.handleExplorerDragStart}
              className="w-3 shrink-0 cursor-col-resize flex items-center justify-center group touch-none border-r border-zinc-700/50"
            >
              <div className="h-10 w-[2px] bg-zinc-600 group-hover:bg-emerald-400 rounded-full transition-colors" />
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <TabBar fs={fs} />

          <div className="flex-1 min-h-[120px]">
            {fs.openTabs.length > 0 ? (
              <Editor
                ref={editorRef}
                onRun={handleRun}
                onFormat={handleFormatCompleted}
                fontSize={layout.fontSize}
                fs={fs}
              />
            ) : fs.loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500 select-none">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin" />
                <p className="text-xs text-zinc-500">Loading workspace...</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-500 select-none px-4">
                <img src="/collab-code/logo.svg" alt="Collab Code" className="w-24 h-24 opacity-40" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-zinc-400">No open editors</p>
                  <p className="text-xs text-zinc-600">
                    Open a file from the Explorer{' '}
                    <button
                      onClick={layout.handleToggleExplorer}
                      className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      (Ctrl+B)
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 bg-[#161b22] border-t border-zinc-700/50 flex items-center">
            <button
              onClick={layout.handleToggleTerminal}
              title="Toggle Terminal (Ctrl+`)"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer touch-manipulation"
            >
              <TerminalIcon className="w-3.5 h-3.5" strokeWidth={2} />
              Terminal
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${layout.terminalVisible ? 'rotate-0' : 'rotate-180'}`} />
            </button>
            {layout.terminalVisible && (
              <div
                onMouseDown={layout.handleTerminalDragStart}
                onTouchStart={layout.handleTerminalDragStart}
                className="flex-1 h-full cursor-row-resize flex items-center justify-center group py-1"
              >
                <div className="w-10 h-[2px] bg-zinc-600 group-hover:bg-emerald-400 rounded-full transition-colors" />
              </div>
            )}
          </div>

          {layout.terminalVisible && (
            <div style={{ height: layout.terminalHeight }} className="shrink-0 bg-[#1a1a2e] overflow-hidden">
              <Terminal
                ref={terminalRef}
                onRunRequested={handleRun}
                fontSize={Math.max(layout.fontSize - 1, 10)}
                fs={fs}
                pushToast={pushToast}
                requestConfirm={layout.requestConfirm}
              />
            </div>
          )}
        </div>
      </div>

      {layout.confirmDialog && (
        <ConfirmDialog
          title={layout.confirmDialog.title}
          message={layout.confirmDialog.message}
          confirmLabel={layout.confirmDialog.confirmLabel}
          secondaryLabel={layout.confirmDialog.secondaryLabel}
          onSecondary={layout.confirmDialog.onSecondary}
          onConfirm={() => {
            layout.confirmDialog?.onConfirm();
            layout.setConfirmDialog(null);
          }}
          onCancel={() => layout.setConfirmDialog(null)}
        />
      )}

      <UndoToastContainer toasts={toasts} onDismiss={dismissToast} />
      {layout.helpOpen && <HelpModal onClose={() => layout.setHelpOpen(false)} />}

      {osDragActive && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="mx-4 max-w-md w-full border-2 border-dashed border-emerald-400/60 bg-[#0d1117]/80 rounded-lg px-6 py-8 text-center">
            <p className="text-sm text-emerald-300 font-medium">Drop files or folders to import</p>
            <p className="text-[11px] text-zinc-400 mt-1">They&apos;ll be added under ~/</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const roomId = useRoom();
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);

  const handleCreateRoom = useCallback((nextRoomId: string) => {
    setCreatedRoomId(nextRoomId);
    window.location.hash = nextRoomId;
  }, []);

  const handleJoinRoom = useCallback((nextRoomId: string) => {
    setCreatedRoomId(null);
    window.location.hash = nextRoomId;
  }, []);

  const handleExitRoom = useCallback(() => {
    setCreatedRoomId(null);
    window.location.hash = '';
  }, []);

  if (!roomId) {
    return (
      <LandingPage
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  return (
    <CollabProvider key={roomId} roomId={roomId}>
      <AppContent
        onExitRoom={handleExitRoom}
        seedDefaultFile={createdRoomId === roomId}
      />
    </CollabProvider>
  );
}

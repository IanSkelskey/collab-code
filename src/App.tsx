import { useCallback, useEffect, useRef, useState } from 'react';
import { useCollab } from './context/CollabContext';
import { useExecution } from './hooks/useExecution';
import { useFileExport } from './hooks/useFileExport';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useRoom } from './hooks/useRoom';
import { useToast } from './hooks/useToast';
import { usePeerPresenceToasts } from './hooks/usePeerPresenceToasts';
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
import ToastContainer from './components/ToastContainer';
import HelpModal from './components/HelpModal';
import LandingPage from './components/LandingPage';
import SearchPanel from './components/SearchPanel';
import MarkdownModeBar from './components/MarkdownModeBar';
import MarkdownPreview from './components/MarkdownPreview';
import { isMarkdownFile } from './config/languages';
import { getRoomStarterWorkspace, type RoomTemplateId } from './config/roomTemplates';
import { ROOT_PATH, joinVfsPath } from './lib/vfsPaths';
import { CollabProvider } from './providers/CollabProvider';

function getNextStarterPath(exists: (path: string) => boolean, fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  const stem = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : '';

  let candidateName = fileName;
  let candidatePath = joinVfsPath(ROOT_PATH, candidateName);
  let copyIndex = 2;

  while (exists(candidatePath)) {
    candidateName = `${stem} ${copyIndex}${extension}`;
    candidatePath = joinVfsPath(ROOT_PATH, candidateName);
    copyIndex += 1;
  }

  return candidatePath;
}

function AppContent({
  onExitRoom,
  initialRoomTemplate,
}: {
  onExitRoom: () => void;
  initialRoomTemplate: RoomTemplateId | null;
}) {
  const { ydoc, peerCount, roomId, connected, awareness, storageReady } = useCollab();
  const fs = useVirtualFS(ydoc, { storageReady, initialRoomTemplate });
  const terminalRef = useRef<TerminalHandle>(null);
  const editorRef = useRef<EditorHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toasts, pushToast, dismissToast } = useToast();
  const layout = useWorkspaceLayout({
    fs,
    editorRef,
    containerRef,
    pushToast,
  });

  const {
    running,
    entryPoints,
    runnableTargets,
    currentRunTarget,
    handleRun,
    handleRunActiveFile,
  } = useExecution({
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
  const markdownActive = isMarkdownFile(fs.activeFile);
  const markdownContent = fs.activeFile ? (fs.readFile(fs.activeFile) ?? '') : '';
  const showMarkdownEditor = !markdownActive || layout.markdownViewMode !== 'preview';
  const showMarkdownPreview = markdownActive && layout.markdownViewMode !== 'write';

  const handleFormatCompleted = useCallback(() => {
    pushToast('Document formatted');
  }, [pushToast]);

  const handleCreateStarterFile = useCallback((templateId: Exclude<RoomTemplateId, 'blank'>) => {
    const starterWorkspace = getRoomStarterWorkspace(templateId);
    if (!starterWorkspace) {
      return;
    }

    const createdPaths = new Map<string, string>();

    for (const file of starterWorkspace.files) {
      const nextPath = getNextStarterPath(fs.exists, file.name);
      fs.writeFile(nextPath, file.content);
      createdPaths.set(file.name, nextPath);
    }

    const initialPath = starterWorkspace.initialOpenFileName
      ? createdPaths.get(starterWorkspace.initialOpenFileName)
      : undefined;
    const pathToOpen = initialPath ?? createdPaths.values().next().value;

    if (pathToOpen) {
      fs.openFile(pathToOpen);
    }

    const createdNames = starterWorkspace.files.map((file) => file.name).join(' and ');
    pushToast(`Created ${createdNames}`);
  }, [fs, pushToast]);

  useKeyboardShortcuts({
    setExplorerVisible: layout.setExplorerVisible,
    setTerminalVisible: layout.setTerminalVisible,
    setSearchVisible: layout.setSearchVisible,
    handleSaveFile,
    handleSaveAll,
  });

  usePeerPresenceToasts({
    awareness,
    connected,
    pushToast,
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
        currentRunTarget={currentRunTarget}
        runTargets={runnableTargets}
        onRunTargetSelect={(filePath) => handleRun(filePath)}
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
                  onRunFile={(filePath) => handleRun(filePath)}
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

          <div className="flex-1 min-h-[120px] flex flex-col">
            {fs.openTabs.length > 0 ? (
              <>
                {markdownActive && (
                  <MarkdownModeBar
                    mode={layout.markdownViewMode}
                    onChange={layout.setMarkdownViewMode}
                  />
                )}

                <div className="flex-1 min-h-0">
                  {markdownActive ? (
                    <div
                      className={`flex h-full w-full min-h-0 ${
                        layout.markdownViewMode === 'split' ? 'flex-col lg:flex-row' : 'flex-col'
                      }`}
                    >
                      <div className={`min-h-0 min-w-0 flex-1 ${showMarkdownEditor ? '' : 'hidden'}`}>
                        <Editor
                          ref={editorRef}
                          onRun={handleRunActiveFile}
                          onFormat={handleFormatCompleted}
                          fontSize={layout.fontSize}
                          fs={fs}
                        />
                      </div>

                      {showMarkdownPreview && fs.activeFile && (
                        <div
                          className={`min-h-0 min-w-0 flex-1 ${
                            showMarkdownEditor
                              ? 'border-t border-zinc-700/50 lg:border-l lg:border-t-0'
                              : ''
                          }`}
                        >
                          <MarkdownPreview
                            content={markdownContent}
                            filePath={fs.activeFile}
                            fs={fs}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <Editor
                      ref={editorRef}
                      onRun={handleRunActiveFile}
                      onFormat={handleFormatCompleted}
                      fontSize={layout.fontSize}
                      fs={fs}
                    />
                  )}
                </div>
              </>
            ) : fs.loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500 select-none">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin" />
                <p className="text-xs text-zinc-500">Loading workspace...</p>
              </div>
            ) : fs.files.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-500 select-none px-4">
                <img src="/collab-code/logo.svg" alt="Collab Code" className="w-24 h-24 opacity-40" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-zinc-300">Choose how to start this room</p>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Create a starter file for Java or Python, or open the Explorer to build your own workspace.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => handleCreateStarterFile('java')}
                    className="px-4 py-2 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white transition-colors cursor-pointer"
                  >
                    New Main.java
                  </button>
                  <button
                    onClick={() => handleCreateStarterFile('python')}
                    className="px-4 py-2 rounded-md text-xs font-medium bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-zinc-100 transition-colors cursor-pointer"
                  >
                    New main.py
                  </button>
                </div>
                <button
                  onClick={() => layout.setExplorerVisible(true)}
                  className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  Open Explorer (Ctrl+B)
                </button>
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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
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
  const [createdRoomTemplate, setCreatedRoomTemplate] = useState<RoomTemplateId | null>(null);

  const handleCreateRoom = useCallback((nextRoomId: string, templateId: RoomTemplateId) => {
    setCreatedRoomId(nextRoomId);
    setCreatedRoomTemplate(templateId);
    window.location.hash = nextRoomId;
  }, []);

  const handleJoinRoom = useCallback((nextRoomId: string) => {
    setCreatedRoomId(null);
    setCreatedRoomTemplate(null);
    window.location.hash = nextRoomId;
  }, []);

  const handleExitRoom = useCallback(() => {
    setCreatedRoomId(null);
    setCreatedRoomTemplate(null);
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
        initialRoomTemplate={createdRoomId === roomId ? createdRoomTemplate : null}
      />
    </CollabProvider>
  );
}

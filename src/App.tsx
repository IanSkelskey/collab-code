import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useCollab } from './context/CollabContext';
import { useExecution } from './hooks/useExecution';
import { useFileExport } from './hooks/useFileExport';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useRoom } from './hooks/useRoom';
import { useToast } from './hooks/useToast';
import { usePeerPresenceToasts } from './hooks/usePeerPresenceToasts';
import { useFollowCollaborator } from './hooks/useFollowCollaborator';
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
  const fs = useVirtualFS(ydoc, { storageReady, initialRoomTemplate, roomId });
  const terminalRef = useRef<TerminalHandle>(null);
  const editorRef = useRef<EditorHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markdownSplitContainerRef = useRef<HTMLDivElement>(null);
  const { toasts, pushToast, dismissToast } = useToast();
  const layout = useWorkspaceLayout({
    fs,
    editorRef,
    containerRef,
    markdownSplitContainerRef,
    pushToast,
  });
  const {
    peers,
    followedPeer,
    followedPeerId,
    toggleFollowPeer,
    stopFollowing,
  } = useFollowCollaborator({
    awareness,
    ydoc,
    fs,
    pushToast,
    navigateToFile: layout.navigateToFile,
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
  const editorLockLabel = followedPeer ? `Following ${followedPeer.name}` : null;
  const markdownSplitStyle = showMarkdownEditor && showMarkdownPreview && layout.markdownViewMode === 'split'
    ? ({ '--cc-markdown-editor-width': `${layout.markdownEditorWidth}px` } as CSSProperties)
    : undefined;

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
      className="cc-app-shell flex h-[100dvh] w-screen flex-col overflow-hidden"
      {...dragHandlers}
    >
      <Toolbar
        roomId={roomId}
        connected={connected}
        peerCount={peerCount}
        peers={peers}
        followedPeer={followedPeer}
        followedPeerId={followedPeerId}
        running={running}
        onRun={() => handleRun()}
        currentRunTarget={currentRunTarget}
        runTargets={runnableTargets}
        onRunTargetSelect={(filePath) => handleRun(filePath)}
        onExitRoom={onExitRoom}
        onSaveAll={handleSaveAll}
        onConfirmLeave={(options) => layout.setConfirmDialog(options)}
        onToggleFollowPeer={toggleFollowPeer}
        onStopFollowing={stopFollowing}
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
                <SearchPanel fs={fs} onNavigateTo={layout.navigateToFile} />
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
              className="cc-divider group flex w-3 shrink-0 cursor-col-resize items-center justify-center border-r touch-none"
            >
              <div className="h-10 w-[2px] rounded-full bg-[var(--cc-border-strong)] transition-colors group-hover:bg-[var(--cc-accent)]" />
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
                      ref={markdownSplitContainerRef}
                      style={markdownSplitStyle}
                      className={`flex h-full w-full min-h-0 ${
                        layout.markdownViewMode === 'split' ? 'flex-col lg:flex-row' : 'flex-col'
                      }`}
                    >
                      <div
                        className={`min-h-0 min-w-0 ${
                          showMarkdownEditor
                            ? showMarkdownPreview && layout.markdownViewMode === 'split'
                              ? 'flex-1 lg:w-[var(--cc-markdown-editor-width)] lg:min-w-[280px] lg:flex-none'
                              : 'flex-1'
                            : 'hidden'
                        }`}
                      >
                        <Editor
                          ref={editorRef}
                          onRun={handleRunActiveFile}
                          onFormat={handleFormatCompleted}
                          fontSize={layout.fontSize}
                          interactionLockedLabel={editorLockLabel}
                          onStopFollowing={followedPeer ? stopFollowing : null}
                          fs={fs}
                        />
                      </div>

                      {showMarkdownEditor && showMarkdownPreview && layout.markdownViewMode === 'split' && (
                        <div
                          onMouseDown={layout.handleMarkdownSplitDragStart}
                          onTouchStart={layout.handleMarkdownSplitDragStart}
                          className="cc-divider hidden w-3 shrink-0 cursor-col-resize items-center justify-center border-l touch-none lg:flex"
                          title="Resize markdown split view"
                        >
                          <div className="h-10 w-[2px] rounded-full bg-[var(--cc-border-strong)] transition-colors hover:bg-[var(--cc-accent)]" />
                        </div>
                      )}

                      {showMarkdownPreview && fs.activeFile && (
                        <div
                          className={`min-h-0 min-w-0 flex-1 ${
                            showMarkdownEditor
                              ? 'cc-divider border-t lg:min-w-[280px] lg:border-t-0'
                              : ''
                          }`}
                        >
                          <MarkdownPreview
                            content={markdownContent}
                            filePath={fs.activeFile}
                            fontSize={layout.fontSize}
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
                      interactionLockedLabel={editorLockLabel}
                      onStopFollowing={followedPeer ? stopFollowing : null}
                      fs={fs}
                    />
                  )}
                </div>
              </>
            ) : fs.loading ? (
              <div className="cc-text-muted flex h-full flex-col items-center justify-center gap-3 select-none">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--cc-border-strong)] border-t-[var(--cc-accent)]" />
                <p className="text-xs">Loading workspace...</p>
              </div>
            ) : fs.files.length === 0 ? (
              <div className="cc-text-muted flex h-full flex-col items-center justify-center gap-4 px-4 select-none">
                <img src="/collab-code/logo.svg" alt="Collab Code" className="w-24 h-24 opacity-40" />
                <div className="text-center space-y-1">
                  <p className="cc-text-secondary text-sm font-medium">Choose how to start this room</p>
                  <p className="max-w-sm text-xs">
                    Create a starter file for Java or Python, or open the Explorer to build your own workspace.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => handleCreateStarterFile('java')}
                    className="cc-button-primary cursor-pointer rounded-md px-4 py-2 text-xs font-medium"
                  >
                    New Main.java
                  </button>
                  <button
                    onClick={() => handleCreateStarterFile('python')}
                    className="cc-button-secondary cursor-pointer rounded-md px-4 py-2 text-xs font-medium"
                  >
                    New main.py
                  </button>
                </div>
                <button
                  onClick={() => layout.setExplorerVisible(true)}
                  className="cc-button-ghost cursor-pointer rounded-md px-2 py-1 text-xs"
                >
                  Open Explorer (Ctrl+B)
                </button>
              </div>
            ) : (
              <div className="cc-text-muted flex h-full flex-col items-center justify-center gap-4 px-4 select-none">
                <img src="/collab-code/logo.svg" alt="Collab Code" className="w-24 h-24 opacity-40" />
                <div className="text-center space-y-1">
                  <p className="cc-text-secondary text-sm font-medium">No open editors</p>
                  <p className="cc-text-faint text-xs">
                    Open a file from the Explorer{' '}
                    <button
                      onClick={layout.handleToggleExplorer}
                      className="cursor-pointer text-[var(--cc-accent)] transition-colors hover:opacity-80"
                    >
                      (Ctrl+B)
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="cc-topbar cc-divider flex shrink-0 items-center border-t">
            <button
              onClick={layout.handleToggleTerminal}
              title="Toggle Terminal (Ctrl+`)"
              className="cc-button-ghost flex cursor-pointer touch-manipulation items-center gap-1.5 px-3 py-1 text-xs font-medium"
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
                <div className="h-[2px] w-10 rounded-full bg-[var(--cc-border-strong)] transition-colors group-hover:bg-[var(--cc-accent)]" />
              </div>
            )}
          </div>

          {layout.terminalVisible && (
            <div style={{ height: layout.terminalHeight }} className="shrink-0 overflow-hidden">
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
        <div className="cc-overlay pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="mx-4 w-full max-w-md rounded-lg border-2 border-dashed border-[var(--cc-accent)] bg-[var(--cc-bg-panel)] px-6 py-8 text-center shadow-[var(--cc-shadow-lg)]">
            <p className="text-sm font-medium text-[var(--cc-accent)]">Drop files or folders to import</p>
            <p className="cc-text-muted mt-1 text-[11px]">They&apos;ll be added under ~/</p>
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

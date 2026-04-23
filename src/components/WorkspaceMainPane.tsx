import { ChevronDownIcon, TerminalIcon } from './Icons';
import Editor from './Editor';
import Terminal from './Terminal';
import FileExplorer from './FileExplorer';
import SearchPanel from './SearchPanel';
import TabBar from './TabBar';
import MarkdownModeBar from './MarkdownModeBar';
import MarkdownPreview from './MarkdownPreview';
import type { WorkspaceController } from '../hooks/useWorkspaceController';

interface WorkspaceMainPaneProps {
  controller: WorkspaceController;
}

export default function WorkspaceMainPane({ controller }: WorkspaceMainPaneProps) {
  const {
    fs,
    layout,
    entryPoints,
    running,
    handleRun,
    handleRunActiveFile,
    handleFormatCompleted,
    handleCreateStarterFile,
    terminalRef,
    editorRef,
    markdownSplitContainerRef,
    markdownActive,
    markdownContent,
    showMarkdownEditor,
    showMarkdownPreview,
    editorLockLabel,
    markdownSplitStyle,
    followedPeer,
    stopFollowing,
    pushToast,
  } = controller;

  return (
    <>
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

          {/* role="separator" is the correct ARIA role for a resize handle,
              but it's classified as a non-interactive role — so the drag
              listeners intentionally trip the noninteractive rule. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize explorer panel"
            onMouseDown={layout.handleExplorerDragStart}
            onTouchStart={layout.handleExplorerDragStart}
            className="cc-divider group flex w-3 shrink-0 cursor-col-resize items-center justify-center border-r touch-none"
          >
            <div className="h-10 w-[2px] rounded-full bg-[var(--cc-border-strong)] transition-colors group-hover:bg-[var(--cc-accent)]" />
          </div>
        </>
      )}

      <main className="flex-1 flex flex-col min-w-0 min-h-0">
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

                    {showMarkdownEditor &&
                      showMarkdownPreview &&
                      layout.markdownViewMode === 'split' && (
                        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label="Resize markdown split view"
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
                <p className="cc-text-secondary text-sm font-medium">
                  Choose how to start this room
                </p>
                <p className="max-w-sm text-xs">
                  Create a starter file for Java or Python, or open the Explorer to build your own
                  workspace.
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
            <ChevronDownIcon
              className={`w-3 h-3 transition-transform ${layout.terminalVisible ? 'rotate-0' : 'rotate-180'}`}
            />
          </button>
          {layout.terminalVisible && (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize terminal panel"
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
      </main>
    </>
  );
}

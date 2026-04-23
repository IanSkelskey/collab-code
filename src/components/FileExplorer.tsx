import { useCallback, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ROOT_PATH } from '../lib/vfsPaths';
import type { FSNode, VirtualFS } from '../hooks/useVirtualFS';
import { getLanguageForFile } from '../config/languages';
import {
  copyFileWithUndo,
  deletePathsWithUndo,
  getTopLevelPaths,
  validateFileName,
} from '../services/fileOps';
import { useExplorerDragAndDrop } from '../hooks/useExplorerDragAndDrop';
import { useExplorerKeyboardShortcuts } from '../hooks/useExplorerKeyboardShortcuts';
import { useExplorerSelection } from '../hooks/useExplorerSelection';
import TreeContext from '../context/TreeContext';
import type { PushToast } from '../types/toast';
import type {
  ExplorerContextMenuItem,
  ExplorerContextMenuState,
  ExplorerCreateState,
} from '../types/fileExplorer';
import ExplorerContextMenu from './ExplorerContextMenu';
import FileExplorerHeader from './FileExplorerHeader';
import FileExplorerSelectionTray from './FileExplorerSelectionTray';
import TreeNode, { FolderIcon, FileIcon, InlineInput } from './TreeNode';

interface FileExplorerProps {
  fs: VirtualFS;
  pushToast: PushToast;
  requestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  entryPoints: Set<string>;
  onRunFile?: (path: string) => void;
  running?: boolean;
}

export default function FileExplorer({
  fs,
  pushToast,
  requestConfirm,
  entryPoints,
  onRunFile,
  running,
}: FileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set([ROOT_PATH]));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState<ExplorerCreateState | null>(null);
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null);

  const expandDir = useCallback((path: string) => {
    setExpandedDirs((currentDirs) => {
      if (currentDirs.has(path)) {
        return currentDirs;
      }

      const nextDirs = new Set(currentDirs);
      nextDirs.add(path);
      return nextDirs;
    });
  }, []);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((currentDirs) => {
      const nextDirs = new Set(currentDirs);
      if (nextDirs.has(path)) {
        nextDirs.delete(path);
      } else {
        nextDirs.add(path);
      }
      return nextDirs;
    });
  }, []);

  const {
    selectedPaths,
    selectedTopLevelPaths,
    clearSelection,
    replaceSelection,
    selectOnlyPath,
    ensurePathSelected,
    handleNodeClick,
  } = useExplorerSelection({
    fs,
    expandedDirs,
    toggleDir,
  });

  const handleDeleteSelection = useCallback(
    (paths: Iterable<string>) => {
      const targets = getTopLevelPaths(paths).filter((path) => fs.exists(path));
      if (targets.length === 0) {
        return;
      }

      const previousActiveFile = fs.activeFile;
      const shouldRestoreActiveFile = previousActiveFile
        ? targets.some(
            (path) => previousActiveFile === path || previousActiveFile.startsWith(`${path}/`),
          )
        : false;

      deletePathsWithUndo(
        fs,
        targets,
        pushToast,
        requestConfirm,
        shouldRestoreActiveFile && previousActiveFile
          ? () => fs.openFile(previousActiveFile)
          : undefined,
      );
    },
    [fs, pushToast, requestConfirm],
  );

  const handleNewFile = useCallback(
    (parentPath: string) => {
      expandDir(parentPath);
      setCreating({ parentPath, type: 'file' });
    },
    [expandDir],
  );

  const handleNewFolder = useCallback(
    (parentPath: string) => {
      expandDir(parentPath);
      setCreating({ parentPath, type: 'directory' });
    },
    [expandDir],
  );

  const handleDeleteNode = useCallback(
    (node: FSNode) => {
      handleDeleteSelection([node.path]);
    },
    [handleDeleteSelection],
  );

  const handleCopyNode = useCallback(
    (node: FSNode) => {
      if (node.type !== 'file') {
        return;
      }

      const copyPath = copyFileWithUndo(fs, node.path, pushToast);
      if (!copyPath) {
        return;
      }

      selectOnlyPath(copyPath);
      fs.openFile(copyPath);
    },
    [fs, pushToast, selectOnlyPath],
  );

  const {
    dragTarget,
    onDragStartNode,
    onDragOverNode,
    onDragLeaveNode,
    onDropNode,
    onDragEnd,
    onRootDragOver,
    onRootDragLeave,
    onRootDrop,
  } = useExplorerDragAndDrop({
    fs,
    selectedPaths,
    selectOnlyPath,
    replaceSelection,
    expandDir,
  });

  const handleCreateRootFile = useCallback(() => {
    handleNewFile(ROOT_PATH);
  }, [handleNewFile]);

  const handleCreateRootFolder = useCallback(() => {
    handleNewFolder(ROOT_PATH);
  }, [handleNewFolder]);

  const handleDeleteCurrentSelection = useCallback(() => {
    handleDeleteSelection(selectedTopLevelPaths);
  }, [handleDeleteSelection, selectedTopLevelPaths]);

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent, node: FSNode) => {
      event.preventDefault();
      event.stopPropagation();
      ensurePathSelected(node.path);
      setContextMenu({ x: event.clientX, y: event.clientY, node });
    },
    [ensurePathSelected],
  );

  useExplorerKeyboardShortcuts({
    hasSelection: selectedTopLevelPaths.length > 0,
    renaming,
    creating,
    onCreateFile: handleCreateRootFile,
    onCreateFolder: handleCreateRootFolder,
    onDeleteSelection: handleDeleteCurrentSelection,
    onClearSelection: clearSelection,
  });

  const getContextMenuItems = useCallback(
    (node: FSNode): ExplorerContextMenuItem[] => {
      if (selectedTopLevelPaths.length > 1 && selectedPaths.has(node.path)) {
        return [
          {
            label: `Delete Selected (${selectedTopLevelPaths.length})`,
            onClick: handleDeleteCurrentSelection,
            danger: true,
          },
          {
            label: 'Clear Selection',
            onClick: clearSelection,
          },
        ];
      }

      const items: ExplorerContextMenuItem[] = [];

      if (node.type === 'file' && entryPoints.has(node.path) && onRunFile) {
        const lang = getLanguageForFile(node.name);
        const entryName = lang?.extractEntryPointName?.(node.name) ?? node.name;
        items.push({ label: `Run ${entryName}`, onClick: () => onRunFile(node.path) });
      }

      if (node.type === 'directory') {
        items.push({ label: 'New File', onClick: () => handleNewFile(node.path) });
        items.push({ label: 'New Folder', onClick: () => handleNewFolder(node.path) });
      }

      if (node.type === 'file') {
        items.push({ label: 'Copy', onClick: () => handleCopyNode(node) });
      }

      if (node.path !== ROOT_PATH) {
        items.push({ label: 'Rename', onClick: () => setRenaming(node.path) });
        items.push({
          label: 'Delete',
          onClick: () => handleDeleteNode(node),
          danger: true,
        });
      }

      return items;
    },
    [
      clearSelection,
      entryPoints,
      handleDeleteCurrentSelection,
      handleDeleteNode,
      handleCopyNode,
      handleNewFile,
      handleNewFolder,
      onRunFile,
      selectedPaths,
      selectedTopLevelPaths,
    ],
  );

  const treeCtx = useMemo(
    () => ({
      fs,
      expandedDirs,
      selectedPaths,
      toggleDir,
      clearSelection,
      onNodeClick: handleNodeClick,
      renaming,
      setRenaming,
      creating,
      setCreating,
      onContextMenu: handleContextMenu,
      dragTarget,
      onDragStartNode,
      onDragOverNode,
      onDragLeaveNode,
      onDropNode,
      onDragEnd,
      entryPoints,
      onRunFile,
      running,
    }),
    [
      clearSelection,
      creating,
      dragTarget,
      entryPoints,
      expandedDirs,
      fs,
      handleContextMenu,
      handleNodeClick,
      onDragEnd,
      onDragLeaveNode,
      onDragOverNode,
      onDragStartNode,
      onDropNode,
      onRunFile,
      renaming,
      running,
      selectedPaths,
      toggleDir,
    ],
  );

  return (
    <div className="cc-sidebar-shell cc-divider relative flex h-full flex-col border-r">
      <FileExplorerHeader
        onCreateFile={handleCreateRootFile}
        onCreateFolder={handleCreateRootFolder}
      />

      {/* Click on empty area of the file list clears selection. Keyboard
          focus and activation live on the treeitem rows inside; the tree
          container itself is only programmatically focusable and has no
          keyboard equivalent for the empty-click shortcut. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div
        role="tree"
        aria-label="File explorer"
        tabIndex={-1}
        className={`flex-1 overflow-y-auto overflow-x-hidden py-1 ${selectedTopLevelPaths.length > 1 ? 'pb-16' : ''}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            clearSelection();
          }
        }}
        onDragOver={onRootDragOver}
        onDragLeave={onRootDragLeave}
        onDrop={onRootDrop}
      >
        <TreeContext.Provider value={treeCtx}>
          {fs.tree.children?.map((child) => (
            <TreeNode key={child.path} node={child} depth={0} />
          ))}

          {(!fs.tree.children || fs.tree.children.length === 0) && (
            <div className="cc-text-faint px-3 py-4 text-center text-xs">No files yet</div>
          )}

          {creating && creating.parentPath === ROOT_PATH && (
            <div
              className="flex items-center gap-1 px-2 py-1.5 text-xs"
              style={{ paddingLeft: '8px' }}
            >
              {creating.type === 'directory' ? <FolderIcon open={false} /> : <FileIcon name="" />}
              <InlineInput
                defaultValue=""
                validate={(name) => {
                  const nameError = validateFileName(name);
                  if (nameError) return nameError;
                  if (fs.exists(`${ROOT_PATH}/${name}`)) return `"${name}" already exists`;
                  return null;
                }}
                onSubmit={(name) => {
                  const newPath = `${ROOT_PATH}/${name}`;
                  if (creating.type === 'file') {
                    fs.writeFile(newPath, '');
                    fs.openFile(newPath);
                  } else {
                    fs.mkdir(newPath);
                  }
                  setCreating(null);
                }}
                onCancel={() => setCreating(null)}
              />
            </div>
          )}

          {dragTarget === ROOT_PATH && (
            <div className="pointer-events-none mx-2 mt-1 rounded border border-dashed border-[var(--cc-accent)] bg-[var(--cc-bg-selection)] px-2 py-2 text-center text-[10px] text-[var(--cc-accent)]">
              Drop here to move to root
            </div>
          )}
        </TreeContext.Provider>
      </div>

      {contextMenu && (
        <ExplorerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}

      <FileExplorerSelectionTray
        selectedCount={selectedTopLevelPaths.length}
        onDelete={handleDeleteCurrentSelection}
        onClear={clearSelection}
      />
    </div>
  );
}

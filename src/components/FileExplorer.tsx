import { useState, useCallback, useRef, useEffect } from 'react';
import type { FSNode, VirtualFS } from '../hooks/useVirtualFS';

// ── Icons ──

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="9 6 15 12 9 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-4 h-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 19a2 2 0 002-2V9a2 2 0 00-2-2h-7.93a2 2 0 01-1.66-.9l-.82-1.2A2 2 0 007.93 4H4a2 2 0 00-2 2v11a2 2 0 002 2h16z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon({ name }: { name: string }) {
  const isJava = name.endsWith('.java');
  const color = isJava ? 'text-orange-400' : 'text-zinc-400';
  return (
    <svg className={`w-4 h-4 shrink-0 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Context menu ──

interface ContextMenuProps {
  x: number;
  y: number;
  items: { label: string; onClick: () => void; danger?: boolean }[];
  onClose: () => void;
}

function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[#1e2030] border border-zinc-700 rounded-md shadow-xl py-1 min-w-[140px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-700 transition-colors ${
            item.danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Inline rename input ──

interface InlineInputProps {
  defaultValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

function InlineInput({ defaultValue, onSubmit, onCancel }: InlineInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      defaultValue={defaultValue}
      autoFocus
      className="bg-zinc-800 text-zinc-100 text-xs px-1 py-0.5 rounded border border-zinc-600 outline-none focus:border-emerald-400 w-full max-w-[160px]"
      onBlur={(e) => {
        const val = e.target.value.trim();
        if (val && val !== defaultValue) onSubmit(val);
        else onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const val = (e.target as HTMLInputElement).value.trim();
          if (val && val !== defaultValue) onSubmit(val);
          else onCancel();
        }
        if (e.key === 'Escape') onCancel();
      }}
    />
  );
}

// ── Tree node component ──

interface TreeNodeProps {
  node: FSNode;
  depth: number;
  fs: VirtualFS;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  renaming: string | null;
  setRenaming: (path: string | null) => void;
  creating: { parentPath: string; type: 'file' | 'directory' } | null;
  setCreating: (v: { parentPath: string; type: 'file' | 'directory' } | null) => void;
  onContextMenu: (e: React.MouseEvent, node: FSNode) => void;
}

function TreeNode({
  node,
  depth,
  fs,
  expandedDirs,
  toggleDir,
  renaming,
  setRenaming,
  creating,
  setCreating,
  onContextMenu,
}: TreeNodeProps) {
  const isDir = node.type === 'directory';
  const isOpen = expandedDirs.has(node.path);
  const isActive = fs.activeFile === node.path;
  const showCreate = creating && creating.parentPath === node.path;

  const handleClick = () => {
    if (isDir) {
      toggleDir(node.path);
    } else {
      fs.openFile(node.path);
    }
  };

  const handleRename = (newName: string) => {
    const parentPath = node.path.split('/').slice(0, -1).join('/');
    const newPath = parentPath + '/' + newName;
    fs.rename(node.path, newPath);
    setRenaming(null);
  };

  const handleCreate = (name: string) => {
    if (!creating) return;
    const newPath = creating.parentPath + '/' + name;
    if (creating.type === 'file') {
      fs.writeFile(newPath, '');
      fs.openFile(newPath);
    } else {
      fs.mkdir(newPath);
    }
    setCreating(null);
  };

  return (
    <>
      <div
        className={`flex items-center gap-1 px-2 py-[3px] cursor-pointer select-none text-xs
          hover:bg-zinc-700/50 transition-colors group
          ${isActive ? 'bg-zinc-700/70 text-white' : 'text-zinc-300'}
        `}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {isDir && <ChevronIcon open={isOpen} />}
        {isDir ? <FolderIcon open={isOpen} /> : <FileIcon name={node.name} />}

        {renaming === node.path ? (
          <InlineInput
            defaultValue={node.name}
            onSubmit={handleRename}
            onCancel={() => setRenaming(null)}
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </div>

      {/* Children */}
      {isDir && isOpen && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          fs={fs}
          expandedDirs={expandedDirs}
          toggleDir={toggleDir}
          renaming={renaming}
          setRenaming={setRenaming}
          creating={creating}
          setCreating={setCreating}
          onContextMenu={onContextMenu}
        />
      ))}

      {/* Inline creation input */}
      {showCreate && isOpen && (
        <div
          className="flex items-center gap-1 px-2 py-[3px] text-xs"
          style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}
        >
          {creating!.type === 'directory' ? (
            <FolderIcon open={false} />
          ) : (
            <FileIcon name=".java" />
          )}
          <InlineInput
            defaultValue=""
            onSubmit={handleCreate}
            onCancel={() => setCreating(null)}
          />
        </div>
      )}
    </>
  );
}

// ── Main FileExplorer component ──

interface FileExplorerProps {
  fs: VirtualFS;
  pushToast: (label: string, onUndo: () => void) => void;
  requestConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export default function FileExplorer({ fs, pushToast, requestConfirm }: FileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['~']));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'directory' } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FSNode;
  } | null>(null);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FSNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleNewFile = useCallback((parentPath: string) => {
    setExpandedDirs((prev) => new Set(prev).add(parentPath));
    setCreating({ parentPath, type: 'file' });
  }, []);

  const handleNewFolder = useCallback((parentPath: string) => {
    setExpandedDirs((prev) => new Set(prev).add(parentPath));
    setCreating({ parentPath, type: 'directory' });
  }, []);

  const handleDelete = useCallback((node: FSNode) => {
    if (node.type === 'file') {
      // Snapshot content for undo
      const content = fs.readFile(node.path) ?? '';
      fs.deleteFile(node.path);
      const name = node.path.split('/').pop() ?? node.path;
      pushToast(`Deleted ${name}`, () => {
        fs.writeFile(node.path, content);
        fs.openFile(node.path);
      });
    } else {
      // Directory — check if non-empty
      const childFiles = fs.files.filter(f => f.startsWith(node.path + '/'));
      if (childFiles.length === 0) {
        // Empty directory — delete immediately
        fs.rmdir(node.path);
      } else {
        // Non-empty — show confirmation
        const dirName = node.path.split('/').pop() ?? node.path;
        requestConfirm(
          `Delete "${dirName}"?`,
          `This will permanently delete ${childFiles.length} file${childFiles.length > 1 ? 's' : ''} inside this directory.`,
          () => {
            // Snapshot all files for undo
            const snapshot: Record<string, string> = {};
            for (const f of childFiles) {
              snapshot[f] = fs.readFile(f) ?? '';
            }
            // Delete all files then directory
            for (const f of childFiles) fs.deleteFile(f);
            fs.rmdir(node.path);
            pushToast(`Deleted ${dirName}/`, () => {
              // Restore directory and all files
              fs.mkdir(node.path);
              for (const [path, content] of Object.entries(snapshot)) {
                fs.writeFile(path, content);
              }
            });
          }
        );
      }
    }
  }, [fs, pushToast, requestConfirm]);

  const getContextMenuItems = useCallback((node: FSNode) => {
    const items: { label: string; onClick: () => void; danger?: boolean }[] = [];

    if (node.type === 'directory') {
      items.push({ label: 'New File', onClick: () => handleNewFile(node.path) });
      items.push({ label: 'New Folder', onClick: () => handleNewFolder(node.path) });
    }

    if (node.path !== '~') {
      items.push({ label: 'Rename', onClick: () => setRenaming(node.path) });
      items.push({
        label: 'Delete',
        onClick: () => handleDelete(node),
        danger: true,
      });
    }

    return items;
  }, [handleNewFile, handleNewFolder, handleDelete]);

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-r border-zinc-700/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleNewFile('~')}
            title="New File"
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="11" x2="12" y2="17" strokeLinecap="round" />
              <line x1="9" y1="14" x2="15" y2="14" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => handleNewFolder('~')}
            title="New Folder"
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="11" x2="12" y2="17" strokeLinecap="round" />
              <line x1="9" y1="14" x2="15" y2="14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {fs.tree.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={0}
            fs={fs}
            expandedDirs={expandedDirs}
            toggleDir={toggleDir}
            renaming={renaming}
            setRenaming={setRenaming}
            creating={creating}
            setCreating={setCreating}
            onContextMenu={handleContextMenu}
          />
        ))}

        {/* If tree is empty */}
        {(!fs.tree.children || fs.tree.children.length === 0) && (
          <div className="px-3 py-4 text-xs text-zinc-500 text-center">
            No files yet
          </div>
        )}

        {/* Root-level inline creation */}
        {creating && creating.parentPath === '~' && (
          <div className="flex items-center gap-1 px-2 py-[3px] text-xs" style={{ paddingLeft: '8px' }}>
            {creating.type === 'directory' ? (
              <FolderIcon open={false} />
            ) : (
              <FileIcon name=".java" />
            )}
            <InlineInput
              defaultValue=""
              onSubmit={(name) => {
                const newPath = '~/' + name;
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
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

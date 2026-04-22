import { useState } from 'react';
import type { FSNode } from '../hooks/useVirtualFS';
import { useTreeContext } from '../context/TreeContext';
import { getLanguageForFile } from '../config/languages';
import { validateFileName } from '../services/fileOps';
import { ChevronRightIcon, FolderClosedIcon, FolderOpenIcon, FileDocIcon, PlayIcon } from './Icons';
import { iconsByName } from './fileIcons';

// ── Icons ──

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <ChevronRightIcon
      className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
    />
  );
}

export function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return <FolderOpenIcon className="w-4 h-4 shrink-0 text-amber-400" />;
  }
  return <FolderClosedIcon className="w-4 h-4 shrink-0 text-amber-400" />;
}

export function FileIcon({ name }: { name: string }) {
  const lang = getLanguageForFile(name);
  const color = lang?.iconColor ?? 'cc-text-muted';
  const iconKey = lang?.iconName ?? lang?.id;
  const IconComp = iconKey ? iconsByName[iconKey] : undefined;

  if (IconComp) {
    return <IconComp className={`w-4 h-4 shrink-0 ${color}`} />;
  }
  return <FileDocIcon className={`w-4 h-4 shrink-0 ${color}`} />;
}

// ── Inline rename/create input ──

export function InlineInput({
  defaultValue,
  onSubmit,
  onCancel,
  validate,
}: {
  defaultValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  validate?: (value: string) => string | null;
}) {
  const [error, setError] = useState<string | null>(null);

  const trySubmit = (val: string) => {
    if (!val || val === defaultValue) {
      onCancel();
      return;
    }
    if (validate) {
      const err = validate(val);
      if (err) {
        setError(err);
        return;
      }
    }
    onSubmit(val);
  };

  return (
    <div className="flex flex-col w-full max-w-[160px]">
      <input
        defaultValue={defaultValue}
        autoFocus
        ref={(el) => el?.select()}
        className={`cc-input-shell cc-input w-full rounded px-1 py-0.5 text-xs outline-none ${
          error ? 'border-red-500 focus:border-red-400' : ''
        }`}
        onBlur={(e) => {
          const val = e.target.value.trim();
          if (!val || val === defaultValue || (validate && validate(val))) {
            onCancel();
            return;
          }
          onSubmit(val);
        }}
        onChange={() => {
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            trySubmit((e.target as HTMLInputElement).value.trim());
          }
          if (e.key === 'Escape') onCancel();
        }}
      />
      {error && <span className="text-[10px] text-red-400 mt-0.5 leading-tight">{error}</span>}
    </div>
  );
}

// ── Tree node ──

interface TreeNodeProps {
  node: FSNode;
  depth: number;
}

export default function TreeNode({ node, depth }: TreeNodeProps) {
  const {
    fs,
    expandedDirs,
    selectedPaths,
    clearSelection,
    onNodeClick,
    renaming,
    setRenaming,
    creating,
    setCreating,
    onContextMenu,
    dragTarget,
    onDragStartNode,
    onDragOverNode,
    onDragLeaveNode,
    onDropNode,
    onDragEnd,
    entryPoints,
    onRunFile,
    running,
  } = useTreeContext();

  const isDir = node.type === 'directory';
  const isOpen = expandedDirs.has(node.path);
  const isActive = fs.activeFile === node.path;
  const isSelected = selectedPaths.has(node.path);
  const showCreate = creating && creating.parentPath === node.path;
  const isDropTarget = isDir && dragTarget === node.path;
  const isEntryPoint = !isDir && entryPoints.has(node.path);

  const validateRename = (newName: string): string | null => {
    const nameError = validateFileName(newName);
    if (nameError) return nameError;
    const parentPath = node.path.split('/').slice(0, -1).join('/');
    const newPath = parentPath + '/' + newName;
    if (fs.exists(newPath)) return `"${newName}" already exists`;
    return null;
  };

  const handleRename = (newName: string) => {
    const parentPath = node.path.split('/').slice(0, -1).join('/');
    const newPath = parentPath + '/' + newName;
    fs.rename(node.path, newPath);
    setRenaming(null);
  };

  const validateCreate = (name: string): string | null => {
    const nameError = validateFileName(name);
    if (nameError) return nameError;
    if (!creating) return null;
    const newPath = creating.parentPath + '/' + name;
    if (fs.exists(newPath)) return `"${name}" already exists`;
    return null;
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
        className={`group flex cursor-pointer select-none items-center gap-1 px-2 py-[3px] text-xs transition-colors
          hover:bg-[var(--cc-bg-hover)]
          ${isActive ? 'bg-[var(--cc-bg-hover-strong)] text-[var(--cc-text-primary)]' : ''}
          ${isSelected ? 'bg-[var(--cc-bg-selection)] text-[var(--cc-text-primary)]' : 'cc-text-secondary'}
          ${isDropTarget ? 'bg-[var(--cc-bg-selection)] outline outline-1 outline-[var(--cc-accent)]' : ''}
        `}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={(e) => onNodeClick(e, node)}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable={node.path !== '~'}
        onDragStart={(e) => onDragStartNode(e, node)}
        onDragOver={(e) => onDragOverNode(e, node)}
        onDragLeave={onDragLeaveNode}
        onDrop={(e) => onDropNode(e, node)}
        onDragEnd={onDragEnd}
      >
        {isDir && <ChevronIcon open={isOpen} />}
        {isDir ? <FolderIcon open={isOpen} /> : <FileIcon name={node.name} />}

        {renaming === node.path ? (
          <InlineInput
            defaultValue={node.name}
            onSubmit={handleRename}
            onCancel={() => setRenaming(null)}
            validate={validateRename}
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}

        {isEntryPoint && !renaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearSelection();
              onRunFile?.(node.path);
            }}
            disabled={running}
            title={`Run ${getLanguageForFile(node.name)?.extractEntryPointName?.(node.name) ?? node.name}`}
            className="ml-auto shrink-0 cursor-pointer rounded p-0.5 text-[var(--cc-accent)] opacity-0 transition-all hover:bg-[var(--cc-bg-hover)] hover:opacity-100 disabled:opacity-30 group-hover:opacity-100"
          >
            <PlayIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {isDir &&
        isOpen &&
        node.children?.map((child) => <TreeNode key={child.path} node={child} depth={depth + 1} />)}

      {showCreate && isOpen && (
        <div
          className="flex items-center gap-1 px-2 py-[3px] text-xs"
          style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}
        >
          {creating!.type === 'directory' ? <FolderIcon open={false} /> : <FileIcon name="" />}
          <InlineInput
            defaultValue=""
            onSubmit={handleCreate}
            onCancel={() => setCreating(null)}
            validate={validateCreate}
          />
        </div>
      )}
    </>
  );
}

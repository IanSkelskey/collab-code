import type { FSNode } from '../hooks/useVirtualFS';
import { useTreeContext } from '../context/TreeContext';
import { getLanguageForFile } from '../config/languages';
import {
  ChevronRightIcon, FolderClosedIcon, FolderOpenIcon,
  FileDocIcon, PlayIcon,
} from './Icons';

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

const langSymbol: Record<string, string> = {
  java: 'J',
  python: 'Py',
  javascript: 'JS',
  typescript: 'TS',
  json: '{ }',
  html: '<>',
  css: '#',
  markdown: 'M',
  c: 'C',
  cpp: 'C+',
  xml: '<>',
};

export function FileIcon({ name }: { name: string }) {
  const lang = getLanguageForFile(name);
  const color = lang?.iconColor ?? 'text-zinc-400';
  const symbol = lang ? langSymbol[lang.id] : undefined;

  return (
    <svg className={`w-4 h-4 shrink-0 ${color}`} viewBox="0 0 24 24" fill="none" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      {symbol && (
        <text
          x="12"
          y="17"
          textAnchor="middle"
          fill="currentColor"
          fontSize={symbol.length > 2 ? '6' : '7.5'}
          fontWeight="bold"
          fontFamily="monospace"
          stroke="none"
        >
          {symbol}
        </text>
      )}
    </svg>
  );
}

// ── Inline rename/create input ──

export function InlineInput({
  defaultValue,
  onSubmit,
  onCancel,
}: {
  defaultValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  return (
    <input
      defaultValue={defaultValue}
      autoFocus
      ref={(el) => el?.select()}
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

// ── Tree node ──

interface TreeNodeProps {
  node: FSNode;
  depth: number;
}

export default function TreeNode({ node, depth }: TreeNodeProps) {
  const {
    fs,
    expandedDirs,
    toggleDir,
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
  const showCreate = creating && creating.parentPath === node.path;
  const isDropTarget = isDir && dragTarget === node.path;
  const isEntryPoint = !isDir && entryPoints.has(node.path);

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
          ${isDropTarget ? 'bg-emerald-500/20 outline outline-1 outline-emerald-500/50' : ''}
        `}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={handleClick}
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
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}

        {isEntryPoint && !renaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRunFile?.(node.path);
            }}
            disabled={running}
            title={`Run ${getLanguageForFile(node.name)?.extractEntryPointName?.(node.name) ?? node.name}`}
            className="ml-auto p-0.5 rounded text-emerald-500 hover:text-emerald-400 hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30 cursor-pointer shrink-0"
          >
            <PlayIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {isDir && isOpen && node.children?.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}

      {showCreate && isOpen && (
        <div
          className="flex items-center gap-1 px-2 py-[3px] text-xs"
          style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}
        >
          {creating!.type === 'directory' ? (
            <FolderIcon open={false} />
          ) : (
            <FileIcon name="" />
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

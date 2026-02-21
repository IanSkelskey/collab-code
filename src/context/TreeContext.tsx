import { createContext, useContext } from 'react';
import type { FSNode, VirtualFS } from '../hooks/useVirtualFS';

export interface TreeContextValue {
  fs: VirtualFS;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  renaming: string | null;
  setRenaming: (path: string | null) => void;
  creating: { parentPath: string; type: 'file' | 'directory' } | null;
  setCreating: (v: { parentPath: string; type: 'file' | 'directory' } | null) => void;
  onContextMenu: (e: React.MouseEvent, node: FSNode) => void;
  dragTarget: string | null;
  onDragStartNode: (e: React.DragEvent, node: FSNode) => void;
  onDragOverNode: (e: React.DragEvent, node: FSNode) => void;
  onDragLeaveNode: () => void;
  onDropNode: (e: React.DragEvent, node: FSNode) => void;
  onDragEnd: () => void;
  entryPoints: Set<string>;
  onRunFile?: (path: string) => void;
  running?: boolean;
}

const TreeContext = createContext<TreeContextValue | null>(null);

export function useTreeContext(): TreeContextValue {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('useTreeContext must be used within a TreeContext.Provider');
  return ctx;
}

export default TreeContext;

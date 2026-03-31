import { createContext, useContext } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import type { FSNode, VirtualFS } from '../hooks/useVirtualFS';
import type { ExplorerCreateState } from '../types/fileExplorer';

export interface TreeContextValue {
  fs: VirtualFS;
  expandedDirs: Set<string>;
  selectedPaths: Set<string>;
  toggleDir: (path: string) => void;
  clearSelection: () => void;
  onNodeClick: (e: MouseEvent, node: FSNode) => void;
  renaming: string | null;
  setRenaming: (path: string | null) => void;
  creating: ExplorerCreateState | null;
  setCreating: (v: ExplorerCreateState | null) => void;
  onContextMenu: (e: MouseEvent, node: FSNode) => void;
  dragTarget: string | null;
  onDragStartNode: (e: DragEvent, node: FSNode) => void;
  onDragOverNode: (e: DragEvent, node: FSNode) => void;
  onDragLeaveNode: () => void;
  onDropNode: (e: DragEvent, node: FSNode) => void;
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

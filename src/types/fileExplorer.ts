import type { FSNode } from '../hooks/useVirtualFS';

export interface ExplorerCreateState {
  parentPath: string;
  type: 'file' | 'directory';
}

export interface ExplorerContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export interface ExplorerContextMenuState {
  x: number;
  y: number;
  node: FSNode;
}

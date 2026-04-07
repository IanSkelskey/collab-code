import type * as Y from 'yjs';

export interface FSNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FSNode[];
}

export interface VirtualFS {
  tree: FSNode;
  files: string[];
  activeFile: string | null;
  openTabs: string[];
  cwd: string;
  contentVersion: number;
  loading: boolean;
  getFileText: (path: string) => Y.Text | null;
  readFile: (path: string) => string | null;
  writeFile: (path: string, content?: string) => void;
  deleteFile: (path: string) => void;
  mkdir: (path: string) => void;
  rmdir: (path: string) => boolean;
  exists: (path: string) => boolean;
  isDirectory: (path: string) => boolean;
  isFile: (path: string) => boolean;
  ls: (dirPath: string) => string[];
  rename: (oldPath: string, newPath: string) => void;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (path: string) => void;
  closeTabsToRight: (path: string) => void;
  setCwd: (path: string) => void;
  resolve: (relativePath: string) => string;
  getAllFiles: () => Record<string, string>;
}

/**
 * Yjs-backed collaborative virtual filesystem.
 *
 * Data model:
 *   - ydoc.getMap('fs')        → Y.Map<Y.Text>  keyed by absolute path (e.g. "~/Main.java")
 *   - ydoc.getArray('fs-dirs') → Y.Array<string> explicit empty directory paths (e.g. "~/src")
 *
 * Files are stored as Y.Text so each file supports collaborative editing via y-monaco.
 * Directories are implicit (derived from file paths) but empty directories are tracked
 * explicitly in the fs-dirs array.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

// ── Types ──

export interface FSNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FSNode[];
}

export interface VirtualFS {
  /** Full tree starting at ~ */
  tree: FSNode;
  /** Flat list of all file paths */
  files: string[];
  /** Currently active file path (open in editor) */
  activeFile: string | null;
  /** Current working directory (for terminal) */
  cwd: string;

  /** Get Y.Text for a file (for editor binding) */
  getFileText: (path: string) => Y.Text | null;
  /** Read file content as string */
  readFile: (path: string) => string | null;
  /** Create or overwrite a file */
  writeFile: (path: string, content?: string) => void;
  /** Delete a file */
  deleteFile: (path: string) => void;
  /** Create a directory */
  mkdir: (path: string) => void;
  /** Delete a directory (must be empty) */
  rmdir: (path: string) => boolean;
  /** Check if a path exists (file or directory) */
  exists: (path: string) => boolean;
  /** Check if path is a directory */
  isDirectory: (path: string) => boolean;
  /** Check if path is a file */
  isFile: (path: string) => boolean;
  /** List contents of a directory */
  ls: (dirPath: string) => string[];
  /** Rename/move a file or directory */
  rename: (oldPath: string, newPath: string) => void;

  /** Set the active file (opens it in the editor) */
  openFile: (path: string) => void;
  /** Set the current working directory */
  setCwd: (path: string) => void;
  /** Resolve a relative path against cwd */
  resolve: (relativePath: string) => string;

  /** Get all files as a map of path→content (for sending to server) */
  getAllFiles: () => Record<string, string>;
}

// ── Helpers ──

/** Normalize a path: resolve . and .., collapse //, ensure starts with ~ */
function normalizePath(p: string): string {
  // Replace backslashes
  let path = p.replace(/\\/g, '/');

  // Handle ~/
  if (!path.startsWith('~')) {
    path = '~/' + path;
  }

  const parts = path.split('/').filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (resolved.length > 1) resolved.pop(); // Don't go above ~
      continue;
    }
    resolved.push(part);
  }

  return resolved.join('/') || '~';
}

/** Get the parent directory path */
function parentDir(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 1) return '~';
  return parts.slice(0, -1).join('/');
}

/** Get the basename of a path */
function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/** Build a tree from a flat list of file paths and directory paths */
function buildTree(filePaths: string[], dirPaths: string[]): FSNode {
  const root: FSNode = { name: '~', path: '~', type: 'directory', children: [] };

  // Collect all directory paths (implicit from files + explicit)
  const allDirs = new Set<string>();
  allDirs.add('~');

  for (const d of dirPaths) {
    const parts = d.split('/');
    for (let i = 1; i <= parts.length; i++) {
      allDirs.add(parts.slice(0, i).join('/'));
    }
  }

  for (const f of filePaths) {
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) {
      allDirs.add(parts.slice(0, i).join('/'));
    }
  }

  // Create directory nodes
  const nodeMap = new Map<string, FSNode>();
  nodeMap.set('~', root);

  const sortedDirs = [...allDirs].sort();
  for (const dir of sortedDirs) {
    if (dir === '~') continue;
    const node: FSNode = { name: basename(dir), path: dir, type: 'directory', children: [] };
    nodeMap.set(dir, node);
    const parent = nodeMap.get(parentDir(dir));
    if (parent) parent.children!.push(node);
  }

  // Add file nodes
  for (const f of filePaths) {
    const node: FSNode = { name: basename(f), path: f, type: 'file' };
    const parent = nodeMap.get(parentDir(f));
    if (parent) parent.children!.push(node);
  }

  // Sort children: directories first, then alphabetical
  function sortChildren(node: FSNode) {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
  }
  sortChildren(root);

  return root;
}

// ── Default file ──

const DEFAULT_MAIN = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Collab Code!");
    }
}
`;

// ── Hook ──

export function useVirtualFS(ydoc: Y.Doc): VirtualFS {
  const fsMap = useMemo(() => ydoc.getMap<Y.Text>('fs'), [ydoc]);
  const fsDirs = useMemo(() => ydoc.getArray<string>('fs-dirs'), [ydoc]);

  const [files, setFiles] = useState<string[]>([]);
  const [dirs, setDirs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [cwd, setCwd] = useState('~');

  // Track if we've seeded the default file
  const seeded = useRef(false);

  // ── Sync state from Yjs ──

  const refreshState = useCallback(() => {
    const filePaths = Array.from(fsMap.keys()).sort();
    const dirPaths = fsDirs.toArray();
    setFiles(filePaths);
    setDirs(dirPaths);
  }, [fsMap, fsDirs]);

  useEffect(() => {
    refreshState();

    const onFsChange = () => refreshState();
    fsMap.observe(onFsChange);
    fsDirs.observe(onFsChange);

    return () => {
      fsMap.unobserve(onFsChange);
      fsDirs.unobserve(onFsChange);
    };
  }, [fsMap, fsDirs, refreshState]);

  // Migrate from old single-file Y.Text('code') to filesystem if needed
  useEffect(() => {
    if (seeded.current) return;

    // Wait a moment for sync
    const timer = setTimeout(() => {
      if (seeded.current) return;
      seeded.current = true;

      if (fsMap.size === 0) {
        // Check if there's existing code in the old Y.Text('code')
        const oldCode = ydoc.getText('code');
        const content = oldCode.toString();

        const ytext = new Y.Text();
        ytext.insert(0, content.length > 0 ? content : DEFAULT_MAIN);
        fsMap.set('~/Main.java', ytext);
        setActiveFile('~/Main.java');
      } else {
        // Open the first file if none is active
        const firstFile = Array.from(fsMap.keys()).sort()[0];
        if (firstFile) setActiveFile(firstFile);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [fsMap, ydoc]);

  // ── Build tree ──

  const tree = useMemo(() => buildTree(files, dirs), [files, dirs]);

  // ── File operations ──

  const getFileText = useCallback((path: string): Y.Text | null => {
    const norm = normalizePath(path);
    return fsMap.get(norm) ?? null;
  }, [fsMap]);

  const readFile = useCallback((path: string): string | null => {
    const ytext = getFileText(path);
    return ytext ? ytext.toString() : null;
  }, [getFileText]);

  const writeFile = useCallback((path: string, content = '') => {
    const norm = normalizePath(path);
    if (!fsMap.has(norm)) {
      const ytext = new Y.Text();
      if (content) ytext.insert(0, content);
      fsMap.set(norm, ytext);
    } else if (content) {
      const ytext = fsMap.get(norm)!;
      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, content);
      });
    }
  }, [fsMap, ydoc]);

  const deleteFile = useCallback((path: string) => {
    const norm = normalizePath(path);
    fsMap.delete(norm);
    if (activeFile === norm) {
      // Open another file
      const remaining = Array.from(fsMap.keys()).filter(k => k !== norm).sort();
      setActiveFile(remaining[0] ?? null);
    }
  }, [fsMap, activeFile]);

  const mkdirFn = useCallback((path: string) => {
    const norm = normalizePath(path);
    // Don't add if it's already implicit from a file
    const existing = fsDirs.toArray();
    if (!existing.includes(norm)) {
      fsDirs.push([norm]);
    }
  }, [fsDirs]);

  const rmdirFn = useCallback((path: string): boolean => {
    const norm = normalizePath(path);
    if (norm === '~') return false;

    // Check if directory has any files
    const hasFiles = Array.from(fsMap.keys()).some(k => k.startsWith(norm + '/'));
    if (hasFiles) return false;

    // Remove from explicit dirs
    const existing = fsDirs.toArray();
    const idx = existing.indexOf(norm);
    if (idx >= 0) {
      fsDirs.delete(idx, 1);
    }

    // Also remove any child dirs
    for (let i = fsDirs.length - 1; i >= 0; i--) {
      if (fsDirs.get(i).startsWith(norm + '/')) {
        fsDirs.delete(i, 1);
      }
    }

    return true;
  }, [fsDirs, fsMap]);

  const existsFn = useCallback((path: string): boolean => {
    const norm = normalizePath(path);
    if (norm === '~') return true;
    if (fsMap.has(norm)) return true;
    // Check if it's an implicit directory
    const isImplicitDir = Array.from(fsMap.keys()).some(k => k.startsWith(norm + '/'));
    if (isImplicitDir) return true;
    // Check explicit dirs
    return fsDirs.toArray().includes(norm);
  }, [fsMap, fsDirs]);

  const isDirectoryFn = useCallback((path: string): boolean => {
    const norm = normalizePath(path);
    if (norm === '~') return true;
    if (fsMap.has(norm)) return false; // It's a file
    return existsFn(norm);
  }, [fsMap, existsFn]);

  const isFileFn = useCallback((path: string): boolean => {
    const norm = normalizePath(path);
    return fsMap.has(norm);
  }, [fsMap]);

  const lsFn = useCallback((dirPath: string): string[] => {
    const norm = normalizePath(dirPath);
    const prefix = norm === '~' ? '~/' : norm + '/';
    const entries = new Set<string>();

    // Files in this directory
    for (const key of fsMap.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        const firstSlash = rest.indexOf('/');
        entries.add(firstSlash >= 0 ? rest.slice(0, firstSlash) + '/' : rest);
      }
    }

    // Explicit dirs in this directory
    for (const d of fsDirs.toArray()) {
      if (d.startsWith(prefix)) {
        const rest = d.slice(prefix.length);
        const firstSlash = rest.indexOf('/');
        entries.add(firstSlash >= 0 ? rest.slice(0, firstSlash) + '/' : rest + '/');
      }
    }

    return [...entries].sort();
  }, [fsMap, fsDirs]);

  const renameFn = useCallback((oldPath: string, newPath: string) => {
    const oldNorm = normalizePath(oldPath);
    const newNorm = normalizePath(newPath);

    if (fsMap.has(oldNorm)) {
      // It's a file — copy content to new path
      const oldText = fsMap.get(oldNorm)!;
      const content = oldText.toString();
      fsMap.delete(oldNorm);

      const newText = new Y.Text();
      if (content) newText.insert(0, content);
      fsMap.set(newNorm, newText);

      if (activeFile === oldNorm) setActiveFile(newNorm);
    } else {
      // It's a directory — rename all files under it
      const oldPrefix = oldNorm + '/';
      const keysToMove = Array.from(fsMap.keys()).filter(k => k.startsWith(oldPrefix));

      for (const key of keysToMove) {
        const oldText = fsMap.get(key)!;
        const content = oldText.toString();
        fsMap.delete(key);

        const newKey = newNorm + key.slice(oldNorm.length);
        const newText = new Y.Text();
        if (content) newText.insert(0, content);
        fsMap.set(newKey, newText);

        if (activeFile === key) setActiveFile(newKey);
      }

      // Rename explicit dirs
      for (let i = fsDirs.length - 1; i >= 0; i--) {
        const d = fsDirs.get(i);
        if (d === oldNorm || d.startsWith(oldPrefix)) {
          fsDirs.delete(i, 1);
          fsDirs.push([newNorm + d.slice(oldNorm.length)]);
        }
      }
    }
  }, [fsMap, fsDirs, activeFile]);

  const openFile = useCallback((path: string) => {
    const norm = normalizePath(path);
    if (fsMap.has(norm)) {
      setActiveFile(norm);
    }
  }, [fsMap]);

  const resolveFn = useCallback((relativePath: string): string => {
    if (relativePath.startsWith('~')) return normalizePath(relativePath);
    const combined = cwd + '/' + relativePath;
    return normalizePath(combined);
  }, [cwd]);

  const getAllFiles = useCallback((): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [key, ytext] of fsMap.entries()) {
      // Strip the ~/ prefix for the server
      const relPath = key.startsWith('~/') ? key.slice(2) : key;
      result[relPath] = ytext.toString();
    }
    return result;
  }, [fsMap]);

  return {
    tree,
    files,
    activeFile,
    cwd,
    getFileText,
    readFile,
    writeFile,
    deleteFile,
    mkdir: mkdirFn,
    rmdir: rmdirFn,
    exists: existsFn,
    isDirectory: isDirectoryFn,
    isFile: isFileFn,
    ls: lsFn,
    rename: renameFn,
    openFile,
    setCwd,
    resolve: resolveFn,
    getAllFiles,
  };
}

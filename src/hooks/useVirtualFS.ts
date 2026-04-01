import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { primaryLanguage } from '../config/languages';
import {
  ROOT_PATH,
  getBaseName,
  getParentPath,
  isRootPath,
  joinVfsPath,
  normalizeVfsPath,
  stripVfsRoot,
} from '../lib/vfsPaths';

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

interface UseVirtualFSOptions {
  storageReady?: boolean;
  seedDefaultFile?: boolean;
}

function buildTree(filePaths: string[], dirPaths: string[]): FSNode {
  const root: FSNode = { name: ROOT_PATH, path: ROOT_PATH, type: 'directory', children: [] };
  const allDirs = new Set<string>([ROOT_PATH]);

  for (const directoryPath of dirPaths) {
    const parts = directoryPath.split('/');
    for (let index = 1; index <= parts.length; index += 1) {
      allDirs.add(parts.slice(0, index).join('/'));
    }
  }

  for (const filePath of filePaths) {
    const parts = filePath.split('/');
    for (let index = 1; index < parts.length; index += 1) {
      allDirs.add(parts.slice(0, index).join('/'));
    }
  }

  const nodeMap = new Map<string, FSNode>([[ROOT_PATH, root]]);

  for (const directoryPath of [...allDirs].sort()) {
    if (directoryPath === ROOT_PATH) continue;

    const directoryNode: FSNode = {
      name: getBaseName(directoryPath),
      path: directoryPath,
      type: 'directory',
      children: [],
    };

    nodeMap.set(directoryPath, directoryNode);
    nodeMap.get(getParentPath(directoryPath))?.children?.push(directoryNode);
  }

  for (const filePath of filePaths) {
    const fileNode: FSNode = {
      name: getBaseName(filePath),
      path: filePath,
      type: 'file',
    };

    nodeMap.get(getParentPath(filePath))?.children?.push(fileNode);
  }

  function sortChildren(node: FSNode) {
    if (!node.children) return;

    node.children.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });

    node.children.forEach(sortChildren);
  }

  sortChildren(root);

  return root;
}

export function useVirtualFS(
  ydoc: Y.Doc,
  { storageReady = false, seedDefaultFile = false }: UseVirtualFSOptions = {},
): VirtualFS {
  const fsMap = useMemo(() => ydoc.getMap<Y.Text>('fs'), [ydoc]);
  const fsDirs = useMemo(() => ydoc.getArray<string>('fs-dirs'), [ydoc]);
  const fsState = useMemo(() => ydoc.getMap<string>('fs-state'), [ydoc]);

  const [files, setFiles] = useState<string[]>([]);
  const [dirs, setDirs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [cwd, setCwdState] = useState(ROOT_PATH);
  const [contentVersion, setContentVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const bootstrapResolvedRef = useRef(false);
  const initialFileOpenedRef = useRef(false);

  const refreshState = useCallback(() => {
    setFiles(Array.from(fsMap.keys()).sort());
    setDirs(fsDirs.toArray());
  }, [fsDirs, fsMap]);

  const refreshCwd = useCallback(() => {
    const nextCwd = fsState.get('cwd');
    setCwdState(typeof nextCwd === 'string' ? normalizeVfsPath(nextCwd) : ROOT_PATH);
  }, [fsState]);

  useEffect(() => {
    refreshState();

    const onFsChange = (event: Y.YMapEvent<Y.Text>) => {
      refreshState();

      const deletedPaths: string[] = [];
      const addedPaths: string[] = [];

      event.changes.keys.forEach((change, key) => {
        if (change.action === 'delete') {
          deletedPaths.push(key);
        } else if (change.action === 'add') {
          addedPaths.push(key);
        }
      });

      if (deletedPaths.length > 0 && addedPaths.length > 0) {
        const renamedPaths = new Map<string, string>();

        if (deletedPaths.length === 1 && addedPaths.length === 1) {
          renamedPaths.set(deletedPaths[0], addedPaths[0]);
        } else {
          for (const oldPath of deletedPaths) {
            const oldName = getBaseName(oldPath);
            const nextPath = addedPaths.find((newPath) => getBaseName(newPath) === oldName);

            if (nextPath) {
              renamedPaths.set(oldPath, nextPath);
            }
          }
        }

        if (renamedPaths.size > 0) {
          setOpenTabs((currentTabs) => currentTabs.map((tab) => renamedPaths.get(tab) ?? tab));
          setActiveFile((currentFile) => (currentFile ? (renamedPaths.get(currentFile) ?? currentFile) : null));
        }

        const pureDeletes = deletedPaths.filter((deletedPath) => !renamedPaths.has(deletedPath));
        if (pureDeletes.length > 0) {
          const removedPaths = new Set(pureDeletes);
          setOpenTabs((currentTabs) => {
            const nextTabs = currentTabs.filter((tab) => !removedPaths.has(tab));

            if (nextTabs.length !== currentTabs.length) {
              setActiveFile((currentFile) => {
                if (currentFile && removedPaths.has(currentFile)) {
                  return nextTabs[0] ?? null;
                }

                return currentFile;
              });
            }

            return nextTabs;
          });
        }

        return;
      }

      if (deletedPaths.length > 0) {
        const removedPaths = new Set(deletedPaths);
        setOpenTabs((currentTabs) => {
          const nextTabs = currentTabs.filter((tab) => !removedPaths.has(tab));

          if (nextTabs.length !== currentTabs.length) {
            setActiveFile((currentFile) => {
              if (currentFile && removedPaths.has(currentFile)) {
                return nextTabs[0] ?? null;
              }

              return currentFile;
            });
          }

          return nextTabs;
        });
      }
    };

    const onDirsChange = () => refreshState();
    const onDeepChange = () => setContentVersion((version) => version + 1);

    fsMap.observe(onFsChange);
    fsDirs.observe(onDirsChange);
    fsMap.observeDeep(onDeepChange);

    return () => {
      fsMap.unobserve(onFsChange);
      fsDirs.unobserve(onDirsChange);
      fsMap.unobserveDeep(onDeepChange);
    };
  }, [fsDirs, fsMap, refreshState]);

  useEffect(() => {
    refreshCwd();

    const onFsStateChange = (event: Y.YMapEvent<string>) => {
      if (event.keysChanged.has('cwd')) {
        refreshCwd();
      }
    };

    fsState.observe(onFsStateChange);
    return () => {
      fsState.unobserve(onFsStateChange);
    };
  }, [fsState, refreshCwd]);

  useEffect(() => {
    if (!storageReady || bootstrapResolvedRef.current) return;

    bootstrapResolvedRef.current = true;
    setLoading(false);

    if (!fsState.has('cwd')) {
      fsState.set('cwd', ROOT_PATH);
    }

    if (fsMap.size > 0 || !seedDefaultFile) {
      return;
    }

    const oldCode = ydoc.getText('code').toString();
    const defaultFile = primaryLanguage.defaultFile;

    if (!defaultFile) {
      return;
    }

    const defaultPath = joinVfsPath(ROOT_PATH, defaultFile.name);
    const ytext = new Y.Text();
    ytext.insert(0, oldCode.length > 0 ? oldCode : defaultFile.content);
    fsMap.set(defaultPath, ytext);
    setActiveFile(defaultPath);
    setOpenTabs([defaultPath]);
    initialFileOpenedRef.current = true;
  }, [fsMap, fsState, seedDefaultFile, storageReady, ydoc]);

  useEffect(() => {
    if (files.length === 0 || initialFileOpenedRef.current) return;
    if (activeFile || openTabs.length > 0) {
      initialFileOpenedRef.current = true;
      return;
    }

    const firstFile = files[0];
    if (!firstFile) return;

    setActiveFile(firstFile);
    setOpenTabs([firstFile]);
    setLoading(false);
    initialFileOpenedRef.current = true;
  }, [activeFile, files, openTabs]);

  const tree = useMemo(() => buildTree(files, dirs), [dirs, files]);

  const getFileText = useCallback((path: string): Y.Text | null => {
    return fsMap.get(normalizeVfsPath(path)) ?? null;
  }, [fsMap]);

  const readFile = useCallback((path: string): string | null => {
    const ytext = getFileText(path);
    return ytext ? ytext.toString() : null;
  }, [getFileText]);

  const writeFile = useCallback((path: string, content?: string) => {
    const normalizedPath = normalizeVfsPath(path);
    const hasContent = content !== undefined;

    if (!fsMap.has(normalizedPath)) {
      const ytext = new Y.Text();
      if (hasContent && content.length > 0) {
        ytext.insert(0, content);
      }
      fsMap.set(normalizedPath, ytext);
      return;
    }

    if (!hasContent) {
      return;
    }

    const ytext = fsMap.get(normalizedPath);
    if (!ytext) return;

    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, content);
    });
  }, [fsMap, ydoc]);

  const deleteFile = useCallback((path: string) => {
    const normalizedPath = normalizeVfsPath(path);

    fsMap.delete(normalizedPath);

    setOpenTabs((currentTabs) => {
      const nextTabs = currentTabs.filter((tab) => tab !== normalizedPath);

      if (activeFile === normalizedPath) {
        const removedIndex = currentTabs.indexOf(normalizedPath);
        const nextActiveFile = nextTabs[Math.min(removedIndex, nextTabs.length - 1)]
          ?? Array.from(fsMap.keys()).filter((key) => key !== normalizedPath).sort()[0]
          ?? null;

        setActiveFile(nextActiveFile);
      }

      return nextTabs;
    });
  }, [activeFile, fsMap]);

  const mkdir = useCallback((path: string) => {
    const normalizedPath = normalizeVfsPath(path);

    if (!fsDirs.toArray().includes(normalizedPath)) {
      fsDirs.push([normalizedPath]);
    }
  }, [fsDirs]);

  const rmdir = useCallback((path: string): boolean => {
    const normalizedPath = normalizeVfsPath(path);

    if (isRootPath(normalizedPath)) {
      return false;
    }

    const hasFiles = Array.from(fsMap.keys()).some((key) => key.startsWith(`${normalizedPath}/`));
    if (hasFiles) {
      return false;
    }

    const existingDirectories = fsDirs.toArray();
    const directIndex = existingDirectories.indexOf(normalizedPath);
    if (directIndex >= 0) {
      fsDirs.delete(directIndex, 1);
    }

    for (let index = fsDirs.length - 1; index >= 0; index -= 1) {
      if (fsDirs.get(index).startsWith(`${normalizedPath}/`)) {
        fsDirs.delete(index, 1);
      }
    }

    return true;
  }, [fsDirs, fsMap]);

  const exists = useCallback((path: string): boolean => {
    const normalizedPath = normalizeVfsPath(path);

    if (isRootPath(normalizedPath) || fsMap.has(normalizedPath)) {
      return true;
    }

    if (Array.from(fsMap.keys()).some((key) => key.startsWith(`${normalizedPath}/`))) {
      return true;
    }

    return fsDirs.toArray().includes(normalizedPath);
  }, [fsDirs, fsMap]);

  const isDirectory = useCallback((path: string): boolean => {
    const normalizedPath = normalizeVfsPath(path);

    if (isRootPath(normalizedPath)) {
      return true;
    }

    if (fsMap.has(normalizedPath)) {
      return false;
    }

    return exists(normalizedPath);
  }, [exists, fsMap]);

  const isFile = useCallback((path: string): boolean => {
    return fsMap.has(normalizeVfsPath(path));
  }, [fsMap]);

  const ls = useCallback((dirPath: string): string[] => {
    const normalizedPath = normalizeVfsPath(dirPath);
    const prefix = isRootPath(normalizedPath) ? `${ROOT_PATH}/` : `${normalizedPath}/`;
    const entries = new Set<string>();

    for (const key of fsMap.keys()) {
      if (!key.startsWith(prefix)) continue;

      const remainder = key.slice(prefix.length);
      const slashIndex = remainder.indexOf('/');
      entries.add(slashIndex >= 0 ? `${remainder.slice(0, slashIndex)}/` : remainder);
    }

    for (const directoryPath of fsDirs.toArray()) {
      if (!directoryPath.startsWith(prefix)) continue;

      const remainder = directoryPath.slice(prefix.length);
      const slashIndex = remainder.indexOf('/');
      entries.add(slashIndex >= 0 ? `${remainder.slice(0, slashIndex)}/` : `${remainder}/`);
    }

    return [...entries].sort();
  }, [fsDirs, fsMap]);

  const rename = useCallback((oldPath: string, newPath: string) => {
    const oldNormalizedPath = normalizeVfsPath(oldPath);
    const newNormalizedPath = normalizeVfsPath(newPath);

    ydoc.transact(() => {
      if (fsMap.has(oldNormalizedPath)) {
        const oldText = fsMap.get(oldNormalizedPath);
        if (!oldText) return;

        const content = oldText.toString();
        fsMap.delete(oldNormalizedPath);

        const newText = new Y.Text();
        if (content) {
          newText.insert(0, content);
        }
        fsMap.set(newNormalizedPath, newText);
        return;
      }

      const oldPrefix = `${oldNormalizedPath}/`;
      const keysToMove = Array.from(fsMap.keys()).filter((key) => key.startsWith(oldPrefix));

      for (const key of keysToMove) {
        const oldText = fsMap.get(key);
        if (!oldText) continue;

        const content = oldText.toString();
        fsMap.delete(key);

        const newKey = `${newNormalizedPath}${key.slice(oldNormalizedPath.length)}`;
        const newText = new Y.Text();
        if (content) {
          newText.insert(0, content);
        }
        fsMap.set(newKey, newText);
      }

      const renamedDirectories: string[] = [];
      for (let index = fsDirs.length - 1; index >= 0; index -= 1) {
        const directoryPath = fsDirs.get(index);
        if (directoryPath === oldNormalizedPath || directoryPath.startsWith(oldPrefix)) {
          renamedDirectories.push(`${newNormalizedPath}${directoryPath.slice(oldNormalizedPath.length)}`);
          fsDirs.delete(index, 1);
        }
      }

      if (renamedDirectories.length > 0) {
        fsDirs.push(renamedDirectories.reverse());
      }
    });

    if (fsMap.has(newNormalizedPath)) {
      if (activeFile === oldNormalizedPath) {
        setActiveFile(newNormalizedPath);
      }

      setOpenTabs((currentTabs) => currentTabs.map((tab) => (
        tab === oldNormalizedPath ? newNormalizedPath : tab
      )));
      return;
    }

    const oldPrefix = `${oldNormalizedPath}/`;

    setOpenTabs((currentTabs) => currentTabs.map((tab) => {
      if (tab === oldNormalizedPath) {
        return newNormalizedPath;
      }

      if (tab.startsWith(oldPrefix)) {
        return `${newNormalizedPath}${tab.slice(oldNormalizedPath.length)}`;
      }

      return tab;
    }));

    if (activeFile && (activeFile === oldNormalizedPath || activeFile.startsWith(oldPrefix))) {
      setActiveFile(`${newNormalizedPath}${activeFile.slice(oldNormalizedPath.length)}`);
    }
  }, [activeFile, fsDirs, fsMap, ydoc]);

  const openFile = useCallback((path: string) => {
    const normalizedPath = normalizeVfsPath(path);

    if (!fsMap.has(normalizedPath)) {
      return;
    }

    setActiveFile(normalizedPath);
    setOpenTabs((currentTabs) => (
      currentTabs.includes(normalizedPath) ? currentTabs : [...currentTabs, normalizedPath]
    ));
  }, [fsMap]);

  const closeTab = useCallback((path: string) => {
    const normalizedPath = normalizeVfsPath(path);

    setOpenTabs((currentTabs) => {
      const nextTabs = currentTabs.filter((tab) => tab !== normalizedPath);

      if (activeFile === normalizedPath) {
        const closingIndex = currentTabs.indexOf(normalizedPath);
        const nextActiveFile = nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
        setActiveFile(nextActiveFile);
      }

      return nextTabs;
    });
  }, [activeFile]);

  const closeAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveFile(null);
  }, []);

  const closeOtherTabs = useCallback((path: string) => {
    const normalizedPath = normalizeVfsPath(path);
    setOpenTabs((currentTabs) => currentTabs.filter((tab) => tab === normalizedPath));
    setActiveFile(normalizedPath);
  }, []);

  const closeTabsToRight = useCallback((path: string) => {
    const normalizedPath = normalizeVfsPath(path);

    setOpenTabs((currentTabs) => {
      const tabIndex = currentTabs.indexOf(normalizedPath);
      if (tabIndex < 0) {
        return currentTabs;
      }

      const nextTabs = currentTabs.slice(0, tabIndex + 1);
      if (activeFile && !nextTabs.includes(activeFile)) {
        setActiveFile(normalizedPath);
      }

      return nextTabs;
    });
  }, [activeFile]);

  const setCwd = useCallback((path: string) => {
    fsState.set('cwd', normalizeVfsPath(path));
  }, [fsState]);

  const resolve = useCallback((relativePath: string): string => {
    if (relativePath.startsWith(ROOT_PATH)) {
      return normalizeVfsPath(relativePath);
    }

    return joinVfsPath(cwd, relativePath);
  }, [cwd]);

  const getAllFiles = useCallback((): Record<string, string> => {
    const allFiles: Record<string, string> = {};

    for (const [path, ytext] of fsMap.entries()) {
      allFiles[stripVfsRoot(path)] = ytext.toString();
    }

    return allFiles;
  }, [fsMap]);

  return {
    tree,
    files,
    activeFile,
    openTabs,
    cwd,
    contentVersion,
    loading,
    getFileText,
    readFile,
    writeFile,
    deleteFile,
    mkdir,
    rmdir,
    exists,
    isDirectory,
    isFile,
    ls,
    rename,
    openFile,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    closeTabsToRight,
    setCwd,
    resolve,
    getAllFiles,
  };
}

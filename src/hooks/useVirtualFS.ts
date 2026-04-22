import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import type { RoomTemplateId } from '../config/roomTemplates';
import {
  closeOtherWorkspaceTabs,
  closeWorkspaceTab,
  closeWorkspaceTabsToRight,
  deleteWorkspaceFile,
  EMPTY_WORKSPACE_SESSION_STATE,
  inferRenamedWorkspacePaths,
  openWorkspaceFile,
  persistWorkspaceSession,
  pruneWorkspaceSessionState,
  readStoredWorkspaceSession,
  removeWorkspacePaths,
  renameWorkspaceSessionPath,
  renameWorkspaceSessionPathsByMap,
  resolveInitialWorkspaceSessionState,
  type StoredWorkspaceSessionState,
} from '../lib/virtualFsSession';
import {
  bootstrapStarterWorkspace,
  deleteStoreFile,
  ensureStoreDirectory,
  getAllStoreFiles,
  getStoreChangePaths,
  isDirectoryInStore,
  listStoreDirectoryEntries,
  listStoreDirectoryPaths,
  listStoreFilePaths,
  pathExistsInStore,
  removeStoreDirectory,
  renameStorePath,
  writeStoreFile,
} from '../lib/virtualFsStore';
import { buildVirtualFsTree } from '../lib/virtualFsTree';
import { ROOT_PATH, joinVfsPath, normalizeVfsPath } from '../lib/vfsPaths';
import type { VirtualFS } from '../types/virtualFs';

export type { FSNode, VirtualFS } from '../types/virtualFs';

interface UseVirtualFSOptions {
  storageReady?: boolean;
  initialRoomTemplate?: RoomTemplateId | null;
  roomId?: string;
}

export function useVirtualFS(
  ydoc: Y.Doc,
  { storageReady = false, initialRoomTemplate = null, roomId }: UseVirtualFSOptions = {},
): VirtualFS {
  const fsMap = useMemo(() => ydoc.getMap<Y.Text>('fs'), [ydoc]);
  const fsDirs = useMemo(() => ydoc.getArray<string>('fs-dirs'), [ydoc]);
  const fsState = useMemo(() => ydoc.getMap<string>('fs-state'), [ydoc]);
  const storedSessionRef = useRef<StoredWorkspaceSessionState | null>(
    readStoredWorkspaceSession(roomId),
  );

  const [files, setFiles] = useState<string[]>([]);
  const [dirs, setDirs] = useState<string[]>([]);
  const [workspaceSession, setWorkspaceSession] = useState<StoredWorkspaceSessionState>(() => ({
    activeFile: storedSessionRef.current?.activeFile ?? null,
    openTabs: storedSessionRef.current?.openTabs ?? [],
  }));
  const [cwd, setCwdState] = useState(ROOT_PATH);
  const [contentVersion, setContentVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const bootstrapResolvedRef = useRef(false);
  const initialFileOpenedRef = useRef(false);

  const { activeFile, openTabs } = workspaceSession;

  const refreshState = useCallback(() => {
    setFiles(listStoreFilePaths(fsMap));
    setDirs(listStoreDirectoryPaths(fsDirs));
  }, [fsDirs, fsMap]);

  const refreshCwd = useCallback(() => {
    const nextCwd = fsState.get('cwd');
    setCwdState(typeof nextCwd === 'string' ? normalizeVfsPath(nextCwd) : ROOT_PATH);
  }, [fsState]);

  useEffect(() => {
    refreshState();

    const onFsChange = (event: Y.YMapEvent<Y.Text>) => {
      refreshState();

      const { addedPaths, deletedPaths } = getStoreChangePaths(event);

      if (deletedPaths.length > 0 && addedPaths.length > 0) {
        const renamedPaths = inferRenamedWorkspacePaths(deletedPaths, addedPaths);

        if (renamedPaths.size > 0) {
          setWorkspaceSession((currentState) =>
            renameWorkspaceSessionPathsByMap(currentState, renamedPaths),
          );
        }

        const pureDeletes = deletedPaths.filter((deletedPath) => !renamedPaths.has(deletedPath));
        if (pureDeletes.length > 0) {
          setWorkspaceSession((currentState) => removeWorkspacePaths(currentState, pureDeletes));
        }

        return;
      }

      if (deletedPaths.length > 0) {
        setWorkspaceSession((currentState) => removeWorkspacePaths(currentState, deletedPaths));
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
    if (!storageReady || bootstrapResolvedRef.current) {
      return;
    }

    bootstrapResolvedRef.current = true;
    setLoading(false);

    if (!fsState.has('cwd')) {
      fsState.set('cwd', ROOT_PATH);
    }

    if (fsMap.size > 0 || !initialRoomTemplate) {
      return;
    }

    const initialPath = bootstrapStarterWorkspace(ydoc, fsMap, initialRoomTemplate);
    if (!initialPath) {
      return;
    }

    setWorkspaceSession({
      activeFile: initialPath,
      openTabs: [initialPath],
    });
    initialFileOpenedRef.current = true;
  }, [fsMap, fsState, initialRoomTemplate, storageReady, ydoc]);

  useEffect(() => {
    if (!storageReady || initialFileOpenedRef.current) {
      return;
    }

    if (files.length === 0) {
      setWorkspaceSession(EMPTY_WORKSPACE_SESSION_STATE);
      setLoading(false);
      initialFileOpenedRef.current = true;
      return;
    }

    setWorkspaceSession((currentState) =>
      resolveInitialWorkspaceSessionState({
        files,
        currentState,
        storedState: storedSessionRef.current,
      }),
    );
    setLoading(false);
    initialFileOpenedRef.current = true;
  }, [files, storageReady]);

  useEffect(() => {
    if (!roomId || !storageReady || !initialFileOpenedRef.current) {
      return;
    }

    persistWorkspaceSession(roomId, pruneWorkspaceSessionState(workspaceSession, files));
  }, [files, roomId, storageReady, workspaceSession]);

  const tree = useMemo(() => buildVirtualFsTree(files, dirs), [dirs, files]);

  const getFileText = useCallback(
    (path: string): Y.Text | null => {
      return fsMap.get(normalizeVfsPath(path)) ?? null;
    },
    [fsMap],
  );

  const readFile = useCallback(
    (path: string): string | null => {
      const ytext = getFileText(path);
      return ytext ? ytext.toString() : null;
    },
    [getFileText],
  );

  const writeFile = useCallback(
    (path: string, content?: string) => {
      writeStoreFile(ydoc, fsMap, path, content);
    },
    [fsMap, ydoc],
  );

  const deleteFile = useCallback(
    (path: string) => {
      const normalizedPath = normalizeVfsPath(path);

      deleteStoreFile(fsMap, normalizedPath);
      setWorkspaceSession((currentState) =>
        deleteWorkspaceFile(currentState, normalizedPath, listStoreFilePaths(fsMap)),
      );
    },
    [fsMap],
  );

  const mkdir = useCallback(
    (path: string) => {
      ensureStoreDirectory(fsDirs, path);
    },
    [fsDirs],
  );

  const rmdir = useCallback(
    (path: string): boolean => {
      return removeStoreDirectory(fsMap, fsDirs, path);
    },
    [fsDirs, fsMap],
  );

  const exists = useCallback(
    (path: string): boolean => {
      return pathExistsInStore(fsMap, fsDirs, path);
    },
    [fsDirs, fsMap],
  );

  const isDirectory = useCallback(
    (path: string): boolean => {
      return isDirectoryInStore(fsMap, fsDirs, path);
    },
    [fsDirs, fsMap],
  );

  const isFile = useCallback(
    (path: string): boolean => {
      return fsMap.has(normalizeVfsPath(path));
    },
    [fsMap],
  );

  const ls = useCallback(
    (dirPath: string): string[] => {
      return listStoreDirectoryEntries(fsMap, fsDirs, dirPath);
    },
    [fsDirs, fsMap],
  );

  const rename = useCallback(
    (oldPath: string, newPath: string) => {
      const oldNormalizedPath = normalizeVfsPath(oldPath);
      const newNormalizedPath = normalizeVfsPath(newPath);

      if (!renameStorePath(ydoc, fsMap, fsDirs, oldNormalizedPath, newNormalizedPath)) {
        return;
      }

      setWorkspaceSession((currentState) =>
        renameWorkspaceSessionPath(currentState, oldNormalizedPath, newNormalizedPath),
      );
    },
    [fsDirs, fsMap, ydoc],
  );

  const openFile = useCallback(
    (path: string) => {
      const normalizedPath = normalizeVfsPath(path);

      if (!fsMap.has(normalizedPath)) {
        return;
      }

      setWorkspaceSession((currentState) => openWorkspaceFile(currentState, normalizedPath));
    },
    [fsMap],
  );

  const closeTab = useCallback((path: string) => {
    setWorkspaceSession((currentState) => closeWorkspaceTab(currentState, path));
  }, []);

  const closeAllTabs = useCallback(() => {
    setWorkspaceSession(EMPTY_WORKSPACE_SESSION_STATE);
  }, []);

  const closeOtherTabs = useCallback((path: string) => {
    setWorkspaceSession((currentState) => closeOtherWorkspaceTabs(currentState, path));
  }, []);

  const closeTabsToRight = useCallback((path: string) => {
    setWorkspaceSession((currentState) => closeWorkspaceTabsToRight(currentState, path));
  }, []);

  const setCwd = useCallback(
    (path: string) => {
      fsState.set('cwd', normalizeVfsPath(path));
    },
    [fsState],
  );

  const resolve = useCallback(
    (relativePath: string): string => {
      if (relativePath.startsWith(ROOT_PATH)) {
        return normalizeVfsPath(relativePath);
      }

      return joinVfsPath(cwd, relativePath);
    },
    [cwd],
  );

  const getAllFiles = useCallback((): Record<string, string> => {
    return getAllStoreFiles(fsMap);
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

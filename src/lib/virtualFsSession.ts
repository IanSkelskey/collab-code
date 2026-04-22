import { readLocalStorageJson, writeLocalStorageJson } from './localStorage';
import { normalizeVfsPath } from './vfsPaths';

export interface StoredWorkspaceSessionState {
  activeFile: string | null;
  openTabs: string[];
}

export const EMPTY_WORKSPACE_SESSION_STATE: StoredWorkspaceSessionState = {
  activeFile: null,
  openTabs: [],
};

function getWorkspaceSessionStorageKey(roomId: string): string {
  return `collab-code-workspace-session:${roomId}`;
}

function normalizeStoredPath(path: unknown): string | null {
  return typeof path === 'string' && path.trim().length > 0 ? normalizeVfsPath(path) : null;
}

function normalizeStoredPaths(paths: Iterable<string>): string[] {
  const normalizedPaths: string[] = [];
  const seenPaths = new Set<string>();

  for (const path of paths) {
    const normalizedPath = normalizeVfsPath(path);
    if (seenPaths.has(normalizedPath)) {
      continue;
    }

    seenPaths.add(normalizedPath);
    normalizedPaths.push(normalizedPath);
  }

  return normalizedPaths;
}

export function parseStoredWorkspaceSession(value: unknown): StoredWorkspaceSessionState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const openTabs = Array.isArray(candidate.openTabs)
    ? normalizeStoredPaths(
        candidate.openTabs.filter(
          (path): path is string => typeof path === 'string' && path.trim().length > 0,
        ),
      )
    : [];

  return {
    activeFile: normalizeStoredPath(candidate.activeFile),
    openTabs,
  };
}

export function readStoredWorkspaceSession(roomId?: string): StoredWorkspaceSessionState | null {
  if (!roomId) {
    return null;
  }

  return readLocalStorageJson(getWorkspaceSessionStorageKey(roomId), parseStoredWorkspaceSession);
}

export function persistWorkspaceSession(
  roomId: string,
  sessionState: StoredWorkspaceSessionState,
): void {
  writeLocalStorageJson(getWorkspaceSessionStorageKey(roomId), sessionState);
}

export function pruneWorkspaceSessionState(
  sessionState: StoredWorkspaceSessionState,
  existingFiles: Iterable<string>,
): StoredWorkspaceSessionState {
  const existingFileSet = new Set(existingFiles);
  const openTabs = normalizeStoredPaths(
    sessionState.openTabs.filter((path) => existingFileSet.has(path)),
  );
  const activeFile =
    sessionState.activeFile && existingFileSet.has(sessionState.activeFile)
      ? sessionState.activeFile
      : null;

  return {
    activeFile,
    openTabs,
  };
}

export function resolveInitialWorkspaceSessionState({
  files,
  currentState,
  storedState,
}: {
  files: string[];
  currentState: StoredWorkspaceSessionState;
  storedState: StoredWorkspaceSessionState | null;
}): StoredWorkspaceSessionState {
  const sanitizedCurrentState = pruneWorkspaceSessionState(currentState, files);
  const restoredActiveFile =
    storedState?.activeFile && files.includes(storedState.activeFile)
      ? storedState.activeFile
      : null;
  const activeFile =
    restoredActiveFile ??
    sanitizedCurrentState.activeFile ??
    sanitizedCurrentState.openTabs[0] ??
    files[0] ??
    null;
  const openTabs =
    activeFile && !sanitizedCurrentState.openTabs.includes(activeFile)
      ? [...sanitizedCurrentState.openTabs, activeFile]
      : sanitizedCurrentState.openTabs;

  return {
    activeFile,
    openTabs,
  };
}

export function inferRenamedWorkspacePaths(
  deletedPaths: string[],
  addedPaths: string[],
): Map<string, string> {
  const renamedPaths = new Map<string, string>();

  if (deletedPaths.length === 1 && addedPaths.length === 1) {
    renamedPaths.set(deletedPaths[0], addedPaths[0]);
    return renamedPaths;
  }

  for (const deletedPath of deletedPaths) {
    const deletedName = deletedPath.split('/').pop();
    const nextPath = addedPaths.find((addedPath) => addedPath.split('/').pop() === deletedName);

    if (deletedName && nextPath) {
      renamedPaths.set(deletedPath, nextPath);
    }
  }

  return renamedPaths;
}

export function renameWorkspaceSessionPathsByMap(
  sessionState: StoredWorkspaceSessionState,
  renamedPaths: ReadonlyMap<string, string>,
): StoredWorkspaceSessionState {
  if (renamedPaths.size === 0) {
    return sessionState;
  }

  return {
    activeFile: sessionState.activeFile
      ? (renamedPaths.get(sessionState.activeFile) ?? sessionState.activeFile)
      : null,
    openTabs: normalizeStoredPaths(
      sessionState.openTabs.map((path) => renamedPaths.get(path) ?? path),
    ),
  };
}

export function renameWorkspaceSessionPath(
  sessionState: StoredWorkspaceSessionState,
  oldPath: string,
  newPath: string,
): StoredWorkspaceSessionState {
  const oldNormalizedPath = normalizeVfsPath(oldPath);
  const newNormalizedPath = normalizeVfsPath(newPath);
  const oldPrefix = `${oldNormalizedPath}/`;
  const renamePath = (path: string) => {
    if (path === oldNormalizedPath) {
      return newNormalizedPath;
    }

    if (path.startsWith(oldPrefix)) {
      return `${newNormalizedPath}${path.slice(oldNormalizedPath.length)}`;
    }

    return path;
  };

  const activeFile = sessionState.activeFile ? renamePath(sessionState.activeFile) : null;
  const openTabs = normalizeStoredPaths(sessionState.openTabs.map(renamePath));

  return activeFile && !openTabs.includes(activeFile)
    ? { activeFile, openTabs: [...openTabs, activeFile] }
    : { activeFile, openTabs };
}

export function removeWorkspacePaths(
  sessionState: StoredWorkspaceSessionState,
  removedPaths: Iterable<string>,
): StoredWorkspaceSessionState {
  const removedPathSet = new Set(normalizeStoredPaths(removedPaths));
  const openTabs = sessionState.openTabs.filter((path) => !removedPathSet.has(path));
  const activeFile =
    sessionState.activeFile && removedPathSet.has(sessionState.activeFile)
      ? (openTabs[0] ?? null)
      : sessionState.activeFile;

  return {
    activeFile,
    openTabs,
  };
}

export function deleteWorkspaceFile(
  sessionState: StoredWorkspaceSessionState,
  path: string,
  remainingFiles: Iterable<string>,
): StoredWorkspaceSessionState {
  const normalizedPath = normalizeVfsPath(path);
  const openTabs = sessionState.openTabs.filter((tab) => tab !== normalizedPath);

  if (sessionState.activeFile !== normalizedPath) {
    return {
      activeFile: sessionState.activeFile,
      openTabs,
    };
  }

  const removedIndex = sessionState.openTabs.indexOf(normalizedPath);
  const remainingFileList = normalizeStoredPaths(remainingFiles).filter(
    (filePath) => filePath !== normalizedPath,
  );
  const activeFile =
    openTabs[Math.min(removedIndex, openTabs.length - 1)] ?? remainingFileList[0] ?? null;

  return {
    activeFile,
    openTabs,
  };
}

export function openWorkspaceFile(
  sessionState: StoredWorkspaceSessionState,
  path: string,
): StoredWorkspaceSessionState {
  const normalizedPath = normalizeVfsPath(path);

  return {
    activeFile: normalizedPath,
    openTabs: sessionState.openTabs.includes(normalizedPath)
      ? sessionState.openTabs
      : [...sessionState.openTabs, normalizedPath],
  };
}

export function closeWorkspaceTab(
  sessionState: StoredWorkspaceSessionState,
  path: string,
): StoredWorkspaceSessionState {
  const normalizedPath = normalizeVfsPath(path);
  const openTabs = sessionState.openTabs.filter((tab) => tab !== normalizedPath);

  if (sessionState.activeFile !== normalizedPath) {
    return {
      activeFile: sessionState.activeFile,
      openTabs,
    };
  }

  const closingIndex = sessionState.openTabs.indexOf(normalizedPath);

  return {
    activeFile: openTabs[Math.min(closingIndex, openTabs.length - 1)] ?? null,
    openTabs,
  };
}

export function closeOtherWorkspaceTabs(
  sessionState: StoredWorkspaceSessionState,
  path: string,
): StoredWorkspaceSessionState {
  const normalizedPath = normalizeVfsPath(path);

  return {
    activeFile: normalizedPath,
    openTabs: sessionState.openTabs.includes(normalizedPath) ? [normalizedPath] : [normalizedPath],
  };
}

export function closeWorkspaceTabsToRight(
  sessionState: StoredWorkspaceSessionState,
  path: string,
): StoredWorkspaceSessionState {
  const normalizedPath = normalizeVfsPath(path);
  const tabIndex = sessionState.openTabs.indexOf(normalizedPath);

  if (tabIndex < 0) {
    return sessionState;
  }

  const openTabs = sessionState.openTabs.slice(0, tabIndex + 1);
  const activeFile =
    sessionState.activeFile && openTabs.includes(sessionState.activeFile)
      ? sessionState.activeFile
      : normalizedPath;

  return {
    activeFile,
    openTabs,
  };
}

import * as Y from 'yjs';
import { getRoomStarterWorkspace, type RoomTemplateId } from '../config/roomTemplates';
import { ROOT_PATH, isRootPath, joinVfsPath, normalizeVfsPath, stripVfsRoot } from './vfsPaths';

export function listStoreFilePaths(fsMap: Y.Map<Y.Text>): string[] {
  return Array.from(fsMap.keys()).sort();
}

export function listStoreDirectoryPaths(fsDirs: Y.Array<string>): string[] {
  return fsDirs.toArray();
}

export function getStoreChangePaths(event: Y.YMapEvent<Y.Text>): {
  addedPaths: string[];
  deletedPaths: string[];
} {
  const addedPaths: string[] = [];
  const deletedPaths: string[] = [];

  event.changes.keys.forEach((change, key) => {
    if (change.action === 'delete') {
      deletedPaths.push(key);
      return;
    }

    if (change.action === 'add') {
      addedPaths.push(key);
    }
  });

  return {
    addedPaths,
    deletedPaths,
  };
}

export function writeStoreFile(
  ydoc: Y.Doc,
  fsMap: Y.Map<Y.Text>,
  path: string,
  content?: string,
): void {
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
  if (!ytext) {
    return;
  }

  ydoc.transact(() => {
    ytext.delete(0, ytext.length);
    ytext.insert(0, content);
  });
}

export function deleteStoreFile(fsMap: Y.Map<Y.Text>, path: string): void {
  fsMap.delete(normalizeVfsPath(path));
}

export function ensureStoreDirectory(fsDirs: Y.Array<string>, path: string): void {
  const normalizedPath = normalizeVfsPath(path);

  if (!fsDirs.toArray().includes(normalizedPath)) {
    fsDirs.push([normalizedPath]);
  }
}

export function removeStoreDirectory(
  fsMap: Y.Map<Y.Text>,
  fsDirs: Y.Array<string>,
  path: string,
): boolean {
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
}

export function pathExistsInStore(
  fsMap: Y.Map<Y.Text>,
  fsDirs: Y.Array<string>,
  path: string,
): boolean {
  const normalizedPath = normalizeVfsPath(path);

  if (isRootPath(normalizedPath) || fsMap.has(normalizedPath)) {
    return true;
  }

  if (Array.from(fsMap.keys()).some((key) => key.startsWith(`${normalizedPath}/`))) {
    return true;
  }

  return fsDirs.toArray().includes(normalizedPath);
}

export function isDirectoryInStore(
  fsMap: Y.Map<Y.Text>,
  fsDirs: Y.Array<string>,
  path: string,
): boolean {
  const normalizedPath = normalizeVfsPath(path);

  if (isRootPath(normalizedPath)) {
    return true;
  }

  if (fsMap.has(normalizedPath)) {
    return false;
  }

  return pathExistsInStore(fsMap, fsDirs, normalizedPath);
}

export function listStoreDirectoryEntries(
  fsMap: Y.Map<Y.Text>,
  fsDirs: Y.Array<string>,
  dirPath: string,
): string[] {
  const normalizedPath = normalizeVfsPath(dirPath);
  const prefix = isRootPath(normalizedPath) ? `${ROOT_PATH}/` : `${normalizedPath}/`;
  const entries = new Set<string>();

  for (const key of fsMap.keys()) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    const remainder = key.slice(prefix.length);
    const slashIndex = remainder.indexOf('/');
    entries.add(slashIndex >= 0 ? `${remainder.slice(0, slashIndex)}/` : remainder);
  }

  for (const directoryPath of fsDirs.toArray()) {
    if (!directoryPath.startsWith(prefix)) {
      continue;
    }

    const remainder = directoryPath.slice(prefix.length);
    const slashIndex = remainder.indexOf('/');
    entries.add(slashIndex >= 0 ? `${remainder.slice(0, slashIndex)}/` : `${remainder}/`);
  }

  return [...entries].sort();
}

export function renameStorePath(
  ydoc: Y.Doc,
  fsMap: Y.Map<Y.Text>,
  fsDirs: Y.Array<string>,
  oldPath: string,
  newPath: string,
): boolean {
  const oldNormalizedPath = normalizeVfsPath(oldPath);
  const newNormalizedPath = normalizeVfsPath(newPath);

  if (oldNormalizedPath === newNormalizedPath) {
    return false;
  }

  if (fsMap.has(oldNormalizedPath)) {
    const oldText = fsMap.get(oldNormalizedPath);
    if (!oldText) {
      return false;
    }

    const content = oldText.toString();

    ydoc.transact(() => {
      fsMap.delete(oldNormalizedPath);

      const newText = new Y.Text();
      if (content) {
        newText.insert(0, content);
      }

      fsMap.set(newNormalizedPath, newText);
    });

    return true;
  }

  const oldPrefix = `${oldNormalizedPath}/`;
  const fileKeysToMove = Array.from(fsMap.keys()).filter((key) => key.startsWith(oldPrefix));
  const directoryPaths = fsDirs.toArray().filter((directoryPath) => (
    directoryPath === oldNormalizedPath || directoryPath.startsWith(oldPrefix)
  ));

  if (fileKeysToMove.length === 0 && directoryPaths.length === 0) {
    return false;
  }

  ydoc.transact(() => {
    for (const key of fileKeysToMove) {
      const oldText = fsMap.get(key);
      if (!oldText) {
        continue;
      }

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

  return true;
}

export function getAllStoreFiles(fsMap: Y.Map<Y.Text>): Record<string, string> {
  const allFiles: Record<string, string> = {};

  for (const [path, ytext] of fsMap.entries()) {
    allFiles[stripVfsRoot(path)] = ytext.toString();
  }

  return allFiles;
}

export function bootstrapStarterWorkspace(
  ydoc: Y.Doc,
  fsMap: Y.Map<Y.Text>,
  initialRoomTemplate: RoomTemplateId,
): string | null {
  const starterWorkspace = getRoomStarterWorkspace(initialRoomTemplate);

  if (!starterWorkspace || starterWorkspace.files.length === 0) {
    return null;
  }

  const oldCode = ydoc.getText('code').toString();

  ydoc.transact(() => {
    for (const file of starterWorkspace.files) {
      const filePath = joinVfsPath(ROOT_PATH, file.name);
      const ytext = new Y.Text();
      const content = file.name === starterWorkspace.initialOpenFileName && oldCode.length > 0
        ? oldCode
        : file.content;

      ytext.insert(0, content);
      fsMap.set(filePath, ytext);
    }
  });

  return starterWorkspace.initialOpenFileName
    ? joinVfsPath(ROOT_PATH, starterWorkspace.initialOpenFileName)
    : joinVfsPath(ROOT_PATH, starterWorkspace.files[0].name);
}

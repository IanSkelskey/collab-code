import type { VirtualFS } from '../hooks/useVirtualFS';
import {
  getBaseName,
  getParentPath,
  isRootPath,
  joinVfsPath,
  normalizeVfsPath,
} from '../lib/vfsPaths';

// ── Name validation ──

const INVALID_NAME_CHARS = /[/\\:*?"<>|]/;

/** Validate a file or folder name. Returns an error message, or null if valid. */
export function validateFileName(name: string): string | null {
  if (!name || !name.trim()) return 'Name cannot be empty';
  if (name === '.' || name === '..') return 'Invalid name';
  if (INVALID_NAME_CHARS.test(name)) return 'Name contains invalid characters: / \\ : * ? " < > |';
  if (name !== name.trim()) return 'Name cannot start or end with a space';
  return null;
}

function splitFileName(name: string): { stem: string; extension: string } {
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex <= 0) {
    return { stem: name, extension: '' };
  }

  return {
    stem: name.slice(0, lastDotIndex),
    extension: name.slice(lastDotIndex),
  };
}

function getCopyBaseName(stem: string): { baseStem: string; startIndex: number } {
  const match = /^(.*?)(?: copy(?: (\d+))?)$/.exec(stem);
  if (!match) {
    return { baseStem: stem, startIndex: 1 };
  }

  const nextIndex = match[2] ? Number.parseInt(match[2], 10) + 1 : 2;
  return {
    baseStem: match[1],
    startIndex: Number.isNaN(nextIndex) ? 1 : nextIndex,
  };
}

function buildCopyName(stem: string, extension: string, copyIndex: number): string {
  if (copyIndex <= 1) {
    return `${stem} copy${extension}`;
  }

  return `${stem} copy ${copyIndex}${extension}`;
}

export function getNextFileCopyPath(vfs: VirtualFS, path: string): string {
  const sourceName = getBaseName(path);
  const parentPath = getParentPath(path);
  const { stem, extension } = splitFileName(sourceName);
  const { baseStem, startIndex } = getCopyBaseName(stem);
  const normalizedStem = baseStem || stem;

  let copyIndex = startIndex;
  let candidatePath = joinVfsPath(parentPath, buildCopyName(normalizedStem, extension, copyIndex));

  while (vfs.exists(candidatePath)) {
    copyIndex += 1;
    candidatePath = joinVfsPath(parentPath, buildCopyName(normalizedStem, extension, copyIndex));
  }

  return candidatePath;
}

export function copyFileWithUndo(
  vfs: VirtualFS,
  path: string,
  pushToast?: (label: string, onUndo: () => void) => void,
): string | null {
  const content = vfs.readFile(path);
  if (content === null) {
    return null;
  }

  const copyPath = getNextFileCopyPath(vfs, path);
  vfs.writeFile(copyPath, content);

  pushToast?.(`Created ${getBaseName(copyPath)}`, () => {
    if (vfs.exists(copyPath)) {
      vfs.deleteFile(copyPath);
    }
  });

  return copyPath;
}

/**
 * Delete a single file with an undo toast.
 * `afterUndo` is called after restoring the file (e.g. to re-open it in the editor).
 */
export function deleteFileWithUndo(
  vfs: VirtualFS,
  path: string,
  pushToast?: (label: string, onUndo: () => void) => void,
  afterUndo?: () => void,
): void {
  const content = vfs.readFile(path) ?? '';
  vfs.deleteFile(path);
  const name = getBaseName(path);
  pushToast?.(`Deleted ${name}`, () => {
    vfs.writeFile(path, content);
    afterUndo?.();
  });
}

/**
 * Delete a directory.  Empty dirs are removed immediately.
 * Non-empty dirs show a confirmation dialog, then snapshot all files for undo.
 */
export function deleteDirWithConfirm(
  vfs: VirtualFS,
  path: string,
  pushToast?: (label: string, onUndo: () => void) => void,
  requestConfirm?: (title: string, message: string, onConfirm: () => void) => void,
): void {
  const allFiles = vfs.files.filter(f => f.startsWith(path + '/'));
  if (allFiles.length === 0) {
    vfs.rmdir(path);
    return;
  }

  const dirName = getBaseName(path);
  requestConfirm?.(
    `Delete "${dirName}"?`,
    `This will permanently delete ${allFiles.length} file${allFiles.length > 1 ? 's' : ''} inside this directory.`,
    () => {
      const snapshot: Record<string, string> = {};
      for (const f of allFiles) {
        snapshot[f] = vfs.readFile(f) ?? '';
      }
      for (const f of allFiles) vfs.deleteFile(f);
      vfs.rmdir(path);
      pushToast?.(
        `Deleted ${dirName}/`,
        () => {
          vfs.mkdir(path);
          for (const [p, c] of Object.entries(snapshot)) {
            vfs.writeFile(p, c);
          }
        },
      );
    },
  );
}

export interface PlannedPathMove {
  from: string;
  to: string;
}

export interface PlannedPathMoveResult {
  moves: PlannedPathMove[];
  skipped: string[];
  error: string | null;
}

function sortByPathDepthAsc(left: string, right: string): number {
  return left.split('/').length - right.split('/').length || left.localeCompare(right);
}

function sortByPathDepthDesc(left: string, right: string): number {
  return right.split('/').length - left.split('/').length || left.localeCompare(right);
}

export function getTopLevelPaths(paths: Iterable<string>): string[] {
  const normalizedPaths = [...new Set(
    Array.from(paths)
      .map((path) => normalizeVfsPath(path))
      .filter((path) => !isRootPath(path)),
  )].sort(sortByPathDepthAsc);

  return normalizedPaths.filter((path, index) => {
    return !normalizedPaths.slice(0, index).some((candidate) => path.startsWith(`${candidate}/`));
  });
}

interface PathSnapshot {
  directories: string[];
  files: Record<string, string>;
}

function collectDirectorySnapshot(
  vfs: VirtualFS,
  dirPath: string,
  directories: Set<string>,
  files: Record<string, string>,
): void {
  directories.add(dirPath);

  for (const entry of vfs.ls(dirPath)) {
    const isDirectoryEntry = entry.endsWith('/');
    const childPath = joinVfsPath(dirPath, isDirectoryEntry ? entry.slice(0, -1) : entry);

    if (isDirectoryEntry) {
      collectDirectorySnapshot(vfs, childPath, directories, files);
      continue;
    }

    files[childPath] = vfs.readFile(childPath) ?? '';
  }
}

function createPathSnapshot(vfs: VirtualFS, paths: string[]): PathSnapshot {
  const directories = new Set<string>();
  const files: Record<string, string> = {};

  for (const path of paths) {
    if (vfs.isFile(path)) {
      files[path] = vfs.readFile(path) ?? '';
      continue;
    }

    if (vfs.isDirectory(path)) {
      collectDirectorySnapshot(vfs, path, directories, files);
    }
  }

  return {
    directories: [...directories].sort(sortByPathDepthAsc),
    files,
  };
}

function restorePathSnapshot(vfs: VirtualFS, snapshot: PathSnapshot): void {
  for (const directoryPath of snapshot.directories) {
    if (!vfs.exists(directoryPath)) {
      vfs.mkdir(directoryPath);
    }
  }

  for (const [filePath, content] of Object.entries(snapshot.files)) {
    vfs.writeFile(filePath, content);
  }
}

export function planMovePaths(
  vfs: VirtualFS,
  paths: Iterable<string>,
  targetDir: string,
): PlannedPathMoveResult {
  const normalizedTargetDir = normalizeVfsPath(targetDir);
  if (!vfs.isDirectory(normalizedTargetDir)) {
    return { moves: [], skipped: [], error: 'Target is not a directory' };
  }

  const topLevelPaths = getTopLevelPaths(paths);
  const moves: PlannedPathMove[] = [];
  const skipped: string[] = [];
  const plannedDestinations = new Set<string>();

  for (const sourcePath of topLevelPaths) {
    if (!vfs.exists(sourcePath)) {
      continue;
    }

    if (sourcePath === normalizedTargetDir) {
      return { moves: [], skipped, error: 'Cannot move a selection into itself' };
    }

    if (normalizedTargetDir.startsWith(`${sourcePath}/`)) {
      return { moves: [], skipped, error: 'Cannot move a folder into its own descendant' };
    }

    if (getParentPath(sourcePath) === normalizedTargetDir) {
      skipped.push(sourcePath);
      continue;
    }

    const destinationPath = joinVfsPath(normalizedTargetDir, getBaseName(sourcePath));
    if (plannedDestinations.has(destinationPath) || vfs.exists(destinationPath)) {
      return {
        moves: [],
        skipped,
        error: `"${getBaseName(destinationPath)}" already exists in the target folder`,
      };
    }

    plannedDestinations.add(destinationPath);
    moves.push({ from: sourcePath, to: destinationPath });
  }

  return { moves, skipped, error: null };
}

export function movePaths(
  vfs: VirtualFS,
  paths: Iterable<string>,
  targetDir: string,
): PlannedPathMoveResult {
  const plan = planMovePaths(vfs, paths, targetDir);
  if (plan.error || plan.moves.length === 0) {
    return plan;
  }

  for (const move of plan.moves) {
    vfs.rename(move.from, move.to);
  }

  return plan;
}

export function deletePathsWithUndo(
  vfs: VirtualFS,
  paths: Iterable<string>,
  pushToast?: (label: string, onUndo: () => void) => void,
  requestConfirm?: (title: string, message: string, onConfirm: () => void) => void,
  afterUndo?: () => void,
): void {
  const topLevelPaths = getTopLevelPaths(paths).filter((path) => vfs.exists(path));
  if (topLevelPaths.length === 0) {
    return;
  }

  if (topLevelPaths.length === 1) {
    const [path] = topLevelPaths;
    if (vfs.isFile(path)) {
      deleteFileWithUndo(vfs, path, pushToast, afterUndo);
      return;
    }

    deleteDirWithConfirm(vfs, path, pushToast, requestConfirm);
    return;
  }

  const snapshot = createPathSnapshot(vfs, topLevelPaths);
  const selectedDirectoryPaths = topLevelPaths.filter((path) => vfs.isDirectory(path));
  const totalFileCount = Object.keys(snapshot.files).length;
  const totalDirCount = selectedDirectoryPaths.length;

  const performDelete = () => {
    Object.keys(snapshot.files).forEach((filePath) => vfs.deleteFile(filePath));
    selectedDirectoryPaths
      .slice()
      .sort(sortByPathDepthDesc)
      .forEach((dirPath) => {
        vfs.rmdir(dirPath);
      });

    pushToast?.(
      `Deleted ${topLevelPaths.length} items`,
      () => {
        restorePathSnapshot(vfs, snapshot);
        afterUndo?.();
      },
    );
  };

  const detailParts: string[] = [];
  if (totalFileCount > 0) {
    detailParts.push(`${totalFileCount} file${totalFileCount === 1 ? '' : 's'}`);
  }
  if (totalDirCount > 0) {
    detailParts.push(`${totalDirCount} folder${totalDirCount === 1 ? '' : 's'}`);
  }

  if (requestConfirm) {
    requestConfirm(
      `Delete ${topLevelPaths.length} items?`,
      `This will permanently delete ${topLevelPaths.length} selected items${detailParts.length > 0 ? `, including ${detailParts.join(' and ')}` : ''}.`,
      performDelete,
    );
    return;
  }

  performDelete();
}

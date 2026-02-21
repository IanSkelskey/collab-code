import type { VirtualFS } from '../hooks/useVirtualFS';

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
  const name = path.split('/').pop() ?? path;
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

  const dirName = path.split('/').pop() ?? path;
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

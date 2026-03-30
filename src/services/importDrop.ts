import type { VirtualFS } from '../hooks/useVirtualFS';
import { joinVfsPath, normalizeVfsPath } from '../lib/vfsPaths';
import {
  hasWebkitEntry,
  isWebkitDirectoryEntry,
  isWebkitFileEntry,
  type WebkitDataTransferItem,
  type WebkitEntry,
  type WebkitFileSystemDirectoryReader,
} from '../types/dragAndDrop';

function toPosix(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\//, '');
}

function splitExt(name: string): { base: string; ext: string } {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, idx), ext: name.slice(idx) };
}

function uniquePath(fs: VirtualFS, fullPath: string): string {
  if (!fs.exists(fullPath)) return fullPath;
  const parts = fullPath.split('/');
  const file = parts.pop()!;
  const dir = parts.join('/') || '~';
  const { base, ext } = splitExt(file);
  let i = 1;
  while (true) {
    const candidate = `${dir}/${base}_${i}${ext}`;
    if (!fs.exists(candidate)) return candidate;
    i++;
  }
}

async function addFile(fs: VirtualFS, baseDir: string, relPath: string, file: File) {
  const safeRel = toPosix(relPath);
  const target = joinVfsPath(baseDir, safeRel);
  const content = await file.text();
  const finalPath = uniquePath(fs, target);
  const parent = finalPath.split('/').slice(0, -1).join('/');
  if (parent && !fs.exists(parent)) fs.mkdir(parent);
  fs.writeFile(finalPath, content);
}

function readEntries(reader: WebkitFileSystemDirectoryReader): Promise<WebkitEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(
      (entries) => resolve(entries as WebkitEntry[]),
      reject,
    );
  });
}

async function getEntryFile(entry: WebkitEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!isWebkitFileEntry(entry)) {
      reject(new Error('Expected a file entry'));
      return;
    }

    entry.file(resolve, reject);
  });
}

async function traverseEntry(fs: VirtualFS, baseDir: string, entry: WebkitEntry, prefix = ''): Promise<number> {
  if (isWebkitFileEntry(entry)) {
    const file = await getEntryFile(entry);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    await addFile(fs, baseDir, rel, file);
    return 1;
  }

  if (isWebkitDirectoryEntry(entry)) {
    const dirPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const reader = entry.createReader();
    let count = 0;
    while (true) {
      const batch = await readEntries(reader);
      if (!batch.length) break;
      for (const child of batch) {
        count += await traverseEntry(fs, baseDir, child, dirPrefix);
      }
    }
    // Create explicit empty dir if it had no files
    if (!count) {
      const norm = normalizeVfsPath(joinVfsPath(baseDir, toPosix(dirPrefix)));
      if (!fs.exists(norm)) fs.mkdir(norm);
    }
    return count;
  }
  return 0;
}

/**
 * Import files/folders from a DataTransfer (OS drag-and-drop) into the virtual FS.
 * Returns number of files created.
 */
export async function importDataTransfer(fs: VirtualFS, dt: DataTransfer, baseDir: string = '~'): Promise<number> {
  let imported = 0;
  const items = dt.items;

  // Prefer webkit entries for proper directory traversal when available
  const firstItem = items.length > 0 ? items[0] : null;
  const hasEntries = firstItem ? hasWebkitEntry(firstItem) : false;
  if (hasEntries) {
    const tasks: Promise<number>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as WebkitDataTransferItem;
      if (item.kind !== 'file') continue;
      const entry = item.webkitGetAsEntry?.() as WebkitEntry | null;
      if (!entry) continue;
      tasks.push(traverseEntry(fs, baseDir, entry));
    }
    const results = await Promise.all(tasks);
    imported = results.reduce((a, b) => a + b, 0);
    return imported;
  }

  // Fallback: plain files (no directory structure)
  if (dt.files && dt.files.length) {
    const files = Array.from(dt.files);
    for (const f of files) {
      const rel = 'webkitRelativePath' in f && typeof f.webkitRelativePath === 'string' && f.webkitRelativePath
        ? f.webkitRelativePath
        : f.name;
      await addFile(fs, baseDir, rel, f);
      imported++;
    }
  }
  return imported;
}

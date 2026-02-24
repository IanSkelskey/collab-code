import type { VirtualFS } from '../hooks/useVirtualFS';

type Entry = any; // FileSystemEntry (webkit); using any for cross-browser typings

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
  const target = `${baseDir}/${safeRel}`.replace(/\/+/g, '/');
  // Ensure parent dirs exist explicitly only if needed for empty dirs; files imply dirs in tree
  const content = await file.text();
  const finalPath = uniquePath(fs, target.startsWith('~') ? target : `~/${safeRel}`);
  const parent = finalPath.split('/').slice(0, -1).join('/');
  if (parent && !fs.exists(parent)) fs.mkdir(parent);
  fs.writeFile(finalPath, content);
}

function readEntries(reader: any): Promise<Entry[]> {
  return new Promise((resolve) => {
    reader.readEntries((entries: Entry[]) => resolve(entries));
  });
}

async function traverseEntry(fs: VirtualFS, baseDir: string, entry: Entry, prefix = ''): Promise<number> {
  if (entry.isFile) {
    const file: File = await new Promise((resolve) => entry.file(resolve));
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    await addFile(fs, baseDir, rel, file);
    return 1;
  }
  if (entry.isDirectory) {
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
      const full = `${baseDir}/${toPosix(dirPrefix)}`;
      const norm = full.startsWith('~') ? full : `~/${toPosix(dirPrefix)}`;
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
  const hasEntries = items && items.length && typeof (items[0] as any).webkitGetAsEntry === 'function';
  if (hasEntries) {
    const tasks: Promise<number>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      const entry = (item as any).webkitGetAsEntry?.();
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
      const rel = (f as any).webkitRelativePath || f.name;
      await addFile(fs, baseDir, rel, f);
      imported++;
    }
  }
  return imported;
}

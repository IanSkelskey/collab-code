export const ROOT_PATH = '~';

function toSlashPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function normalizeVfsPath(path: string): string {
  const slashPath = toSlashPath(path).replace(/^\/+/, '');
  const basePath = slashPath.startsWith(ROOT_PATH) ? slashPath : `${ROOT_PATH}/${slashPath}`;
  const parts = basePath.split('/').filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '.') continue;

    if (part === '..') {
      if (resolved.length > 1) {
        resolved.pop();
      }
      continue;
    }

    resolved.push(part);
  }

  return resolved.join('/') || ROOT_PATH;
}

export function isRootPath(path: string): boolean {
  return normalizeVfsPath(path) === ROOT_PATH;
}

export function getParentPath(path: string): string {
  const normalized = normalizeVfsPath(path);
  const parts = normalized.split('/');

  if (parts.length <= 1) {
    return ROOT_PATH;
  }

  return parts.slice(0, -1).join('/');
}

export function getBaseName(path: string): string {
  const normalized = normalizeVfsPath(path);
  const parts = normalized.split('/');

  return parts[parts.length - 1] ?? ROOT_PATH;
}

export function joinVfsPath(...parts: string[]): string {
  const joined = parts.filter(Boolean).join('/');
  return normalizeVfsPath(joined || ROOT_PATH);
}

export function stripVfsRoot(path: string): string {
  const normalized = normalizeVfsPath(path);

  if (normalized === ROOT_PATH) {
    return '';
  }

  return normalized.startsWith(`${ROOT_PATH}/`) ? normalized.slice(2) : normalized;
}

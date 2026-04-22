type LocalStorageParser<T> = (value: unknown) => T | null;

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

export function readLocalStorageItem(key: string): string | null {
  if (!hasWindow()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorageItem(key: string, value: string): void {
  if (!hasWindow()) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures and let the in-memory state continue.
  }
}

export function removeLocalStorageItem(key: string): void {
  if (!hasWindow()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and let the in-memory state continue.
  }
}

export function readLocalStorageJson<T>(key: string, parse: LocalStorageParser<T>): T | null {
  const rawValue = readLocalStorageItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return parse(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function writeLocalStorageJson(key: string, value: unknown): void {
  if (!hasWindow()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures and let the in-memory state continue.
  }
}

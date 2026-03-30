import { useSyncExternalStore } from 'react';

/**
 * Read room ID from the URL hash. Returns null when no hash is present
 * (landing page should be shown in that case).
 */
export function useRoom(): string | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('hashchange', onStoreChange);
      return () => window.removeEventListener('hashchange', onStoreChange);
    },
    () => {
      const hash = window.location.hash.slice(1); // remove #
      if (hash) return hash;
      return null;
    },
    () => null,
  );
}

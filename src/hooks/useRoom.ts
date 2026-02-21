import { useMemo } from 'react';

/**
 * Read room ID from the URL hash. Returns null when no hash is present
 * (landing page should be shown in that case).
 */
export function useRoom(): string | null {
  const roomId = useMemo(() => {
    const hash = window.location.hash.slice(1); // remove #
    if (hash) return hash;
    return null;
  }, []);

  return roomId;
}

import { useMemo } from 'react';

function generateRoomId(): string {
  // Use crypto.randomUUID if available, else fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
}

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

export { generateRoomId };

import { useMemo } from 'react';

function generateRoomId(): string {
  // Use crypto.randomUUID if available, else fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
}

export function useRoom(): string {
  const roomId = useMemo(() => {
    const hash = window.location.hash.slice(1); // remove #
    if (hash) return hash;

    const newId = generateRoomId();
    window.location.hash = newId;
    return newId;
  }, []);

  return roomId;
}

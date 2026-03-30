import { createContext, useContext } from 'react';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import type { CollabProvider as SyncProvider } from '../providers/SyncProvider';

export interface CollabContextValue {
  ydoc: Y.Doc;
  provider: SyncProvider | null;
  awareness: Awareness | null;
  roomId: string;
  peerCount: number;
  connected: boolean;
  storageReady: boolean;
  userName: string;
  userColor: string;
  peerColors: readonly string[];
  setUserName: (name: string) => void;
  setUserColor: (color: string) => void;
}

export const CollabContext = createContext<CollabContextValue | null>(null);

export function useCollab(): CollabContextValue {
  const context = useContext(CollabContext);

  if (!context) {
    throw new Error('useCollab must be used within CollabProvider');
  }

  return context;
}


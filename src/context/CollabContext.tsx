import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { CollabProvider as SyncProvider } from '../providers/SyncProvider';
import type { Awareness } from 'y-protocols/awareness';

const PEER_COLORS = [
  '#e06c75', '#61afef', '#98c379', '#e5c07b', '#c678dd',
  '#56b6c2', '#d19a66', '#be5046', '#7ec699', '#f99157',
];

function getRandomName(): string {
  const adjectives = ['Swift', 'Bold', 'Keen', 'Wise', 'Calm', 'Brave', 'Fair', 'Glad'];
  const animals = ['Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Deer', 'Lynx', 'Crane'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj} ${animal}`;
}

interface CollabContextValue {
  ydoc: Y.Doc;
  provider: SyncProvider | null;
  awareness: Awareness | null;
  roomId: string;
  peerCount: number;
  connected: boolean;
  userName: string;
  userColor: string;
  peerColors: readonly string[];
  setUserName: (name: string) => void;
  setUserColor: (color: string) => void;
}

const CollabContext = createContext<CollabContextValue | null>(null);

export function useCollab(): CollabContextValue {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error('useCollab must be used within CollabProvider');
  return ctx;
}

interface CollabProviderProps {
  roomId: string;
  children: ReactNode;
}

export function CollabProvider({ roomId, children }: CollabProviderProps) {
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const [provider, setProvider] = useState<SyncProvider | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [peerCount, setPeerCount] = useState(1);
  const [connected, setConnected] = useState(false);
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('collab-code-username') || getRandomName();
  });
  const [userColor, setUserColor] = useState(() => {
    return localStorage.getItem('collab-code-color') || PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
  });

  // Persist username and color to localStorage
  useEffect(() => {
    localStorage.setItem('collab-code-username', userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('collab-code-color', userColor);
  }, [userColor]);

  // Create provider — only depends on roomId
  useEffect(() => {
    const ydoc = ydocRef.current;
    const fullRoomName = `collab-code-${roomId}`;

    // Local persistence
    const idb = new IndexeddbPersistence(fullRoomName, ydoc);

    // Sync via WebSocket server
    const syncProvider = new SyncProvider(fullRoomName, ydoc);

    // Track peers
    const updatePeers = () => {
      setPeerCount(syncProvider.awareness.getStates().size);
    };
    syncProvider.awareness.on('change', updatePeers);
    updatePeers();

    // Track connection status
    const handleStatus = ({ status }: { status: string }) => {
      setConnected(status === 'connected');
    };
    syncProvider.on('status', handleStatus);

    setProvider(syncProvider);
    setAwareness(syncProvider.awareness);

    // Clean up awareness on tab close/refresh so stale peers don't linger
    const handleUnload = () => {
      syncProvider.awareness.setLocalState(null);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      syncProvider.off('status', handleStatus);
      syncProvider.awareness.off('change', updatePeers);
      syncProvider.awareness.setLocalState(null);
      syncProvider.destroy();
      idb.destroy();
    };
  }, [roomId]);

  // Update awareness when user info changes (name edits, etc.)
  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
    });
  }, [awareness, userName, userColor]);

  const value: CollabContextValue = {
    ydoc: ydocRef.current,
    provider,
    awareness,
    roomId,
    peerCount,
    connected,
    userName,
    userColor,
    peerColors: PEER_COLORS,
    setUserName,
    setUserColor,
  };

  return (
    <CollabContext.Provider value={value}>
      {children}
    </CollabContext.Provider>
  );
}

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Awareness } from 'y-protocols/awareness';
import { CollabProvider as SyncProvider } from './SyncProvider';
import { CollabContext, type CollabContextValue } from '../context/CollabContext';
import { ensureSharedTerminalInitialized } from '../services/sharedTerminal';

const PEER_COLORS = [
  '#e06c75',
  '#61afef',
  '#98c379',
  '#e5c07b',
  '#c678dd',
  '#56b6c2',
  '#d19a66',
  '#be5046',
  '#7ec699',
  '#f99157',
] as const;

function getRandomName(): string {
  const adjectives = ['Swift', 'Bold', 'Keen', 'Wise', 'Calm', 'Brave', 'Fair', 'Glad'];
  const animals = ['Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Deer', 'Lynx', 'Crane'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];

  return `${adjective} ${animal}`;
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
  const [storageReady, setStorageReady] = useState(false);
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('collab-code-username') || getRandomName();
  });
  const [userColor, setUserColor] = useState(() => {
    return localStorage.getItem('collab-code-color') || PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
  });

  useEffect(() => {
    localStorage.setItem('collab-code-username', userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('collab-code-color', userColor);
  }, [userColor]);

  useEffect(() => {
    const ydoc = ydocRef.current;
    const fullRoomName = `collab-code-${roomId}`;
    const idb = new IndexeddbPersistence(fullRoomName, ydoc);
    const syncProvider = new SyncProvider(fullRoomName, ydoc);
    let cancelled = false;
    let indexedDbReady = false;
    let websocketReady = false;

    setStorageReady(false);

    const tryInitializeSharedState = () => {
      if (cancelled || !indexedDbReady || !websocketReady) {
        return;
      }

      ensureSharedTerminalInitialized(ydoc);
    };

    void idb.whenSynced.then(() => {
      indexedDbReady = true;
      if (!cancelled) {
        setStorageReady(true);
      }
      tryInitializeSharedState();
    });

    const updatePeers = () => {
      setPeerCount(syncProvider.awareness.getStates().size);
    };

    const handleStatus = ({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setConnected(status === 'connected');
    };

    const handleSync = (synced: boolean) => {
      websocketReady = synced;
      if (synced) {
        tryInitializeSharedState();
      }
    };

    syncProvider.awareness.on('change', updatePeers);
    syncProvider.on('status', handleStatus);
    syncProvider.on('sync', handleSync);
    updatePeers();

    setProvider(syncProvider);
    setAwareness(syncProvider.awareness);

    const handleUnload = () => {
      syncProvider.awareness.setLocalState(null);
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', handleUnload);
      syncProvider.off('status', handleStatus);
      syncProvider.off('sync', handleSync);
      syncProvider.awareness.off('change', updatePeers);
      syncProvider.awareness.setLocalState(null);
      syncProvider.destroy();
      void idb.destroy();
      setProvider(null);
      setAwareness(null);
      setConnected(false);
      setPeerCount(1);
      setStorageReady(false);
    };
  }, [roomId]);

  useEffect(() => {
    if (!awareness) return;

    awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
    });
  }, [awareness, userName, userColor]);

  const value = useMemo<CollabContextValue>(() => ({
    ydoc: ydocRef.current,
    provider,
    awareness,
    roomId,
    peerCount,
    connected,
    storageReady,
    userName,
    userColor,
    peerColors: PEER_COLORS,
    setUserName,
    setUserColor,
  }), [
    provider,
    awareness,
    roomId,
    peerCount,
    connected,
    storageReady,
    userName,
    userColor,
  ]);

  return (
    <CollabContext.Provider value={value}>
      {children}
    </CollabContext.Provider>
  );
}

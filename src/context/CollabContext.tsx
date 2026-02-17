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
  userName: string;
  userColor: string;
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
  const [userName] = useState(() => getRandomName());
  const [userColor] = useState(
    () => PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
  );

  useEffect(() => {
    const ydoc = ydocRef.current;
    const fullRoomName = `collab-code-${roomId}`;

    // Local persistence
    const idb = new IndexeddbPersistence(fullRoomName, ydoc);

    // Sync via WebSocket server — works reliably through campus WiFi,
    // corporate firewalls, and any NAT configuration.
    const trysteroProvider = new SyncProvider(fullRoomName, ydoc);

    // Set local awareness state
    trysteroProvider.awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
    });

    // Track peers
    const updatePeers = () => {
      setPeerCount(trysteroProvider.awareness.getStates().size);
    };
    trysteroProvider.awareness.on('change', updatePeers);
    updatePeers();

    setProvider(trysteroProvider);
    setAwareness(trysteroProvider.awareness);

    return () => {
      trysteroProvider.awareness.off('change', updatePeers);
      trysteroProvider.destroy();
      idb.destroy();
    };
  }, [roomId, userName, userColor]);

  const value: CollabContextValue = {
    ydoc: ydocRef.current,
    provider,
    awareness,
    roomId,
    peerCount,
    userName,
    userColor,
  };

  return (
    <CollabContext.Provider value={value}>
      {children}
    </CollabContext.Provider>
  );
}

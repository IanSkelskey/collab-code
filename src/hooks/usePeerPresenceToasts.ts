import { useEffect, useRef } from 'react';
import type { Awareness } from 'y-protocols/awareness';

const PRESENCE_BOOTSTRAP_DELAY_MS = 1500;

function getPeerLabel(state: unknown): string {
  if (!state || typeof state !== 'object') {
    return 'A peer';
  }

  const user = (state as { user?: { name?: string } }).user;
  if (!user || typeof user.name !== 'string') {
    return 'A peer';
  }

  const trimmedName = user.name.trim();
  return trimmedName || 'A peer';
}

function collectRemotePeers(awareness: Awareness): Map<number, string> {
  const peers = new Map<number, string>();
  const localClientId = awareness.clientID;

  awareness.getStates().forEach((state, clientId) => {
    if (clientId === localClientId) {
      return;
    }

    peers.set(clientId, getPeerLabel(state));
  });

  return peers;
}

interface UsePeerPresenceToastsOptions {
  awareness: Awareness | null;
  connected: boolean;
  pushToast: (label: string) => void;
}

export function usePeerPresenceToasts({
  awareness,
  connected,
  pushToast,
}: UsePeerPresenceToastsOptions): void {
  const knownPeersRef = useRef<Map<number, string>>(new Map());
  const notificationsEnabledRef = useRef(false);

  useEffect(() => {
    if (!awareness || !connected) {
      knownPeersRef.current = new Map();
      notificationsEnabledRef.current = false;
      return;
    }

    knownPeersRef.current = collectRemotePeers(awareness);
    notificationsEnabledRef.current = false;

    const enableNotificationsTimeout = window.setTimeout(() => {
      knownPeersRef.current = collectRemotePeers(awareness);
      notificationsEnabledRef.current = true;
    }, PRESENCE_BOOTSTRAP_DELAY_MS);

    const handleChange = () => {
      const previousPeers = knownPeersRef.current;
      const nextPeers = collectRemotePeers(awareness);

      if (notificationsEnabledRef.current) {
        nextPeers.forEach((name, clientId) => {
          if (!previousPeers.has(clientId)) {
            pushToast(`${name} joined`);
          }
        });

        previousPeers.forEach((name, clientId) => {
          if (!nextPeers.has(clientId)) {
            pushToast(`${name} left`);
          }
        });
      }

      knownPeersRef.current = nextPeers;
    };

    awareness.on('change', handleChange);

    return () => {
      window.clearTimeout(enableNotificationsTimeout);
      awareness.off('change', handleChange);
      knownPeersRef.current = new Map();
      notificationsEnabledRef.current = false;
    };
  }, [awareness, connected, pushToast]);
}

import { useEffect, useRef } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import enterSoundUrl from '../../assets/in.mp3';
import leaveSoundUrl from '../../assets/out.mp3';

const PRESENCE_BOOTSTRAP_DELAY_MS = 1500;
const PRESENCE_SOUND_VOLUME = 0.6;

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

function createPresenceAudio(src: string): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') {
    return null;
  }

  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.volume = PRESENCE_SOUND_VOLUME;
  return audio;
}

function playPresenceAudio(audio: HTMLAudioElement | null): void {
  if (!audio) {
    return;
  }

  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Ignore autoplay or decode failures; presence toasts still provide feedback.
  });
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
  const enterAudioRef = useRef<HTMLAudioElement | null>(null);
  const leaveAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    enterAudioRef.current = createPresenceAudio(enterSoundUrl);
    leaveAudioRef.current = createPresenceAudio(leaveSoundUrl);

    return () => {
      enterAudioRef.current?.pause();
      leaveAudioRef.current?.pause();
      enterAudioRef.current = null;
      leaveAudioRef.current = null;
    };
  }, []);

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
            playPresenceAudio(enterAudioRef.current);
          }
        });

        previousPeers.forEach((name, clientId) => {
          if (!nextPeers.has(clientId)) {
            pushToast(`${name} left`);
            playPresenceAudio(leaveAudioRef.current);
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

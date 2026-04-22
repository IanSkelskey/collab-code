import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { getRemoteSelections } from '../services/editorSelections';
import type { PeerState } from '../types';
import type { PushToast } from '../types/toast';
import usePeers from './usePeers';
import type { VirtualFS } from './useVirtualFS';

interface UseFollowCollaboratorOptions {
  awareness: Awareness | null;
  ydoc: Y.Doc;
  fs: VirtualFS;
  pushToast: PushToast;
  navigateToFile: (file: string, line?: number, col?: number) => void;
}

const FOLLOWING_PEER_FIELD = 'followingPeerId';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getPeerName(state: unknown): string {
  if (!isRecord(state) || !isRecord(state.user)) {
    return 'Someone';
  }

  const name = state.user.name;
  return typeof name === 'string' && name.trim() ? name.trim() : 'Someone';
}

function getFollowingPeerId(state: unknown): number | null {
  if (!isRecord(state)) {
    return null;
  }

  const followingPeerId = state[FOLLOWING_PEER_FIELD];
  return typeof followingPeerId === 'number' && Number.isFinite(followingPeerId)
    ? followingPeerId
    : null;
}

function getLineColumnFromOffset(text: string, rawOffset: number): { line: number; col: number } {
  const offset = Math.max(0, Math.min(rawOffset, text.length));
  let line = 1;
  let col = 1;

  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }

  return { line, col };
}

function resolvePeerCursorPosition(
  state: unknown,
  ydoc: Y.Doc,
  ytext: Y.Text,
): { line: number; col: number } | null {
  const primarySelection = getRemoteSelections(state)[0];
  if (!primarySelection) {
    return null;
  }

  const headPosition = Y.createAbsolutePositionFromRelativePosition(primarySelection.head, ydoc);
  if (!headPosition || headPosition.type !== ytext) {
    return null;
  }

  return getLineColumnFromOffset(ytext.toString(), headPosition.index);
}

export function useFollowCollaborator({
  awareness,
  ydoc,
  fs,
  pushToast,
  navigateToFile,
}: UseFollowCollaboratorOptions) {
  const { peers } = usePeers();
  const { exists, getFileText, isDirectory, isFile } = fs;
  const [followedPeerId, setFollowedPeerId] = useState<number | null>(null);
  const lastTargetRef = useRef<string | null>(null);
  const knownFollowersRef = useRef<Map<number, string>>(new Map());
  const followersInitializedRef = useRef(false);
  const followedPeer = useMemo(
    () => peers.find((peer) => peer.clientId === followedPeerId) ?? null,
    [followedPeerId, peers],
  );

  const clearFollowTarget = useCallback(
    (peerName?: string, silent = false) => {
      lastTargetRef.current = null;
      setFollowedPeerId(null);

      if (!silent) {
        pushToast(`Stopped following ${peerName ?? 'presenter'}`);
      }
    },
    [pushToast],
  );

  const stopFollowing = useCallback(
    (silent = false) => {
      if (followedPeerId === null) {
        return;
      }

      clearFollowTarget(followedPeer?.name ?? 'peer', silent);
    },
    [clearFollowTarget, followedPeer?.name, followedPeerId],
  );

  const toggleFollowPeer = useCallback(
    (peer: PeerState) => {
      lastTargetRef.current = null;

      if (followedPeerId === peer.clientId) {
        clearFollowTarget(peer.name);
        return;
      }

      setFollowedPeerId(peer.clientId);
      pushToast(`Following ${peer.name}`, {
        label: 'Stop',
        onAction: () => clearFollowTarget(peer.name),
      });
    },
    [clearFollowTarget, followedPeerId, pushToast],
  );

  useEffect(() => {
    if (!awareness) {
      return;
    }

    awareness.setLocalStateField(FOLLOWING_PEER_FIELD, followedPeerId);
  }, [awareness, followedPeerId]);

  useEffect(() => {
    if (!awareness || followedPeerId === null) {
      return;
    }

    const syncFollowTarget = () => {
      const state = awareness.getStates().get(followedPeerId);
      if (!state) {
        const peerName = followedPeer?.name ?? 'peer';
        clearFollowTarget(peerName, true);
        pushToast(`Stopped following ${peerName} because they left the room`);
        return;
      }

      const peerFile =
        isRecord(state) && typeof state.activeFile === 'string' ? state.activeFile : null;

      if (!peerFile || !exists(peerFile) || isDirectory(peerFile)) {
        const nextTargetKey = peerFile ? `${peerFile}:open` : 'no-file';
        if (lastTargetRef.current === nextTargetKey) {
          return;
        }

        lastTargetRef.current = nextTargetKey;

        if (peerFile && isFile(peerFile)) {
          navigateToFile(peerFile);
        }
        return;
      }

      const ytext = getFileText(peerFile);
      const position = ytext ? resolvePeerCursorPosition(state, ydoc, ytext) : null;
      const nextTargetKey = position
        ? `${peerFile}:${position.line}:${position.col}`
        : `${peerFile}:open`;

      if (lastTargetRef.current === nextTargetKey) {
        return;
      }

      lastTargetRef.current = nextTargetKey;
      navigateToFile(peerFile, position?.line, position?.col);
    };

    syncFollowTarget();
    awareness.on('change', syncFollowTarget);

    return () => {
      awareness.off('change', syncFollowTarget);
    };
  }, [
    awareness,
    clearFollowTarget,
    exists,
    followedPeer?.name,
    followedPeerId,
    getFileText,
    isDirectory,
    isFile,
    navigateToFile,
    pushToast,
    ydoc,
  ]);

  useEffect(() => {
    if (!awareness) {
      knownFollowersRef.current = new Map();
      followersInitializedRef.current = false;
      return;
    }

    const localClientId = awareness.clientID;

    const collectFollowers = (): Map<number, string> => {
      const followers = new Map<number, string>();

      awareness.getStates().forEach((state, clientId) => {
        if (clientId === localClientId) {
          return;
        }

        if (getFollowingPeerId(state) !== localClientId) {
          return;
        }

        followers.set(clientId, getPeerName(state));
      });

      return followers;
    };

    const syncFollowers = () => {
      const nextFollowers = collectFollowers();

      if (!followersInitializedRef.current) {
        knownFollowersRef.current = nextFollowers;
        followersInitializedRef.current = true;
        return;
      }

      nextFollowers.forEach((name, clientId) => {
        if (!knownFollowersRef.current.has(clientId)) {
          pushToast(`${name} is following you`);
        }
      });

      knownFollowersRef.current.forEach((name, clientId) => {
        if (!nextFollowers.has(clientId)) {
          pushToast(`${name} stopped following you`);
        }
      });

      knownFollowersRef.current = nextFollowers;
    };

    syncFollowers();
    awareness.on('change', syncFollowers);

    return () => {
      awareness.off('change', syncFollowers);
      knownFollowersRef.current = new Map();
      followersInitializedRef.current = false;
    };
  }, [awareness, pushToast]);

  return {
    peers,
    followedPeerId,
    followedPeer,
    toggleFollowPeer,
    stopFollowing,
  };
}

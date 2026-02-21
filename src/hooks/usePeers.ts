import { useEffect, useState } from 'react';
import { useCollab } from '../context/CollabContext';
import type { PeerState } from '../types';

export default function usePeers() {
  const { awareness } = useCollab();
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [peersByFile, setPeersByFile] = useState<Map<string, PeerState[]>>(new Map());

  useEffect(() => {
    if (!awareness) return;

    const update = () => {
      const all: PeerState[] = [];
      const byFile = new Map<string, PeerState[]>();
      const localId = awareness.clientID;

      awareness.getStates().forEach((state, clientId) => {
        const user = state.user as { name: string; color: string } | undefined;
        if (!user) return;

        const file = state.activeFile as string | undefined;
        const peer: PeerState = { name: user.name, color: user.color, clientId, activeFile: file };
        all.push(peer);

        // Build per-file map (excluding self)
        if (clientId !== localId && file) {
          const list = byFile.get(file) ?? [];
          list.push(peer);
          byFile.set(file, list);
        }
      });

      setPeers(all);
      setPeersByFile(byFile);
    };

    awareness.on('change', update);
    update();
    return () => { awareness.off('change', update); };
  }, [awareness]);

  return { peers, peersByFile };
}

import { useEffect, useState } from 'react';
import { useCollab } from '../context/CollabContext';
import type { PeerState } from '../types';

export default function PeerAvatars() {
  const { awareness, userName, userColor } = useCollab();
  const [peers, setPeers] = useState<PeerState[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const update = () => {
      const states: PeerState[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (state.user) {
          states.push({
            name: state.user.name,
            color: state.user.color,
            clientId,
          });
        }
      });
      setPeers(states);
    };

    awareness.on('change', update);
    update();

    return () => {
      awareness.off('change', update);
    };
  }, [awareness]);

  return (
    <div className="flex items-center gap-1">
      {peers.map((peer) => {
        const isMe = peer.name === userName && peer.color === userColor;
        return (
          <div
            key={peer.clientId}
            className="relative group"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-default border-2"
              style={{
                backgroundColor: peer.color,
                borderColor: isMe ? '#fff' : 'transparent',
                opacity: isMe ? 1 : 0.85,
              }}
              title={isMe ? `${peer.name} (you)` : peer.name}
            >
              {peer.name.charAt(0)}
            </div>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {isMe ? `${peer.name} (you)` : peer.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

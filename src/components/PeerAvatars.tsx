import { useEffect, useState, useRef } from 'react';
import { useCollab } from '../context/CollabContext';
import type { PeerState } from '../types';

export default function PeerAvatars() {
  const { awareness, userName, userColor, setUserName } = useCollab();
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing]);

  const handleStartEdit = () => {
    setEditValue(userName);
    setEditing(true);
  };

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== userName) {
      setUserName(trimmed);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {peers.map((peer) => {
        const isMe = peer.name === userName && peer.color === userColor;
        return (
          <div
            key={peer.clientId}
            className="relative group"
          >
            <div
              onClick={isMe ? handleStartEdit : undefined}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white border-2 ${
                isMe ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{
                backgroundColor: peer.color,
                borderColor: isMe ? '#fff' : 'transparent',
                opacity: isMe ? 1 : 0.85,
              }}
              title={isMe ? `${peer.name} (you) — click to rename` : peer.name}
            >
              {peer.name.charAt(0).toUpperCase()}
              {/* Pencil icon overlay on hover (own avatar only) */}
              {isMe && !editing && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
            {/* Tooltip */}
            {!editing && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {isMe ? `${peer.name} (you)` : peer.name}
              </div>
            )}
            {/* Inline edit input */}
            {isMe && editing && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50">
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.slice(0, 20))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  onBlur={handleSubmit}
                  className="w-28 px-2 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded text-white outline-none focus:border-emerald-400"
                  placeholder="Your name"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

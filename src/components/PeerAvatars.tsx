import { useEffect, useRef, useState } from 'react';
import { useCollab } from '../context/CollabContext';
import { EyeIcon, PencilIcon } from './Icons';
import type { PeerState } from '../types';

interface PeerAvatarsProps {
  peers: PeerState[];
  followedPeerId: number | null;
  onToggleFollowPeer: (peer: PeerState) => void;
}

export default function PeerAvatars({
  peers,
  followedPeerId,
  onToggleFollowPeer,
}: PeerAvatarsProps) {
  const { userName, userColor, setUserName, setUserColor, peerColors, awareness } = useCollab();
  const localClientId = awareness?.clientID ?? -1;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;

    const handler = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== userName) {
          setUserName(trimmed);
        }
        setEditing(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, editValue, setUserName, userName]);

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
        const isMe = peer.clientId === localClientId;
        const isFollowing = !isMe && followedPeerId === peer.clientId;
        const peerFileName = !isMe ? peer.activeFile?.split('/').pop() : undefined;

        return (
          <div key={peer.clientId} className="group relative">
            <button
              type="button"
              onClick={
                isMe
                  ? handleStartEdit
                  : () => {
                      setEditing(false);
                      onToggleFollowPeer(peer);
                    }
              }
              aria-label={
                isMe
                  ? `${peer.name} (you), edit your name`
                  : isFollowing
                    ? `Stop following ${peer.name}`
                    : peerFileName
                      ? `Follow ${peer.name} at ${peerFileName}`
                      : `Follow ${peer.name}`
              }
              aria-pressed={!isMe ? isFollowing : undefined}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-bold text-white sm:h-7 sm:w-7 sm:text-xs"
              style={{
                backgroundColor: peer.color,
                borderColor: isMe ? '#fff' : isFollowing ? 'var(--cc-accent)' : 'transparent',
                opacity: isMe || isFollowing ? 1 : 0.85,
              }}
              title={
                isMe
                  ? `${peer.name} (you) - click to edit`
                  : isFollowing
                    ? `${peer.name} - following live. Click to stop`
                    : peerFileName
                      ? `${peer.name} - click to follow live at ${peerFileName}`
                      : `${peer.name} - click to follow live`
              }
            >
              {peer.name.charAt(0).toUpperCase()}
              {isMe && !editing && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[var(--cc-backdrop)] opacity-0 transition-opacity group-hover:opacity-100">
                  <PencilIcon className="h-3 w-3 text-white" />
                </div>
              )}
              {!isMe && (
                <div
                  className={`absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--cc-bg-panel)] transition-all sm:h-4 sm:w-4 ${
                    isFollowing
                      ? 'bg-[var(--cc-accent)] text-[var(--cc-bg-panel)] opacity-100'
                      : 'bg-[var(--cc-bg-elevated)] text-[var(--cc-text-muted)] opacity-0 group-hover:opacity-90'
                  }`}
                >
                  <EyeIcon className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                </div>
              )}
            </button>

            {!editing && (
              <div className="cc-menu cc-text-primary pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                {isMe
                  ? `${peer.name} (you)`
                  : isFollowing
                    ? `Following ${peer.name}${peerFileName ? ` -> ${peerFileName}` : ''}`
                    : peerFileName
                      ? `Follow ${peer.name} -> ${peerFileName}`
                      : `Follow ${peer.name}`}
              </div>
            )}

            {isMe && editing && (
              <div
                ref={popoverRef}
                className="cc-menu absolute top-full left-1/2 z-50 mt-1 min-w-[140px] -translate-x-1/2 space-y-2 rounded-lg p-2"
              >
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value.slice(0, 20))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSubmit();
                    if (event.key === 'Escape') setEditing(false);
                  }}
                  className="cc-input-shell cc-input w-full rounded px-2 py-1 text-xs outline-none"
                  placeholder="Your name"
                />
                <div className="grid grid-cols-5 gap-1">
                  {peerColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setUserColor(color)}
                      className={`h-5 w-5 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 ${
                        color === userColor ? 'scale-110 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

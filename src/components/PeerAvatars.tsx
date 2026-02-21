import { useEffect, useState, useRef } from 'react';
import { useCollab } from '../context/CollabContext';
import usePeers from '../hooks/usePeers';
import { PencilIcon } from './Icons';
import type { VirtualFS } from '../hooks/useVirtualFS';

interface PeerAvatarsProps {
  fs?: VirtualFS;
}

export default function PeerAvatars({ fs }: PeerAvatarsProps) {
  const { userName, userColor, setUserName, setUserColor, peerColors, awareness } = useCollab();
  const { peers } = usePeers();
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

  // Close popover on outside click
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        // Submit any name change and close
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== userName) {
          setUserName(trimmed);
        }
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, editValue, userName, setUserName]);

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

  const handleGoToPeer = (file: string | undefined) => {
    if (file && fs) {
      fs.openFile(file);
    }
  };

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {peers.map((peer) => {
        const isMe = peer.clientId === localClientId;
        const peerFile = !isMe ? peer.activeFile : undefined;
        const peerFileName = peerFile?.split('/').pop();
        return (
          <div
            key={peer.clientId}
            className="relative group"
          >
            <div
              onClick={isMe ? handleStartEdit : peerFile ? () => handleGoToPeer(peerFile) : undefined}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white border-2 ${
                isMe || peerFile ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{
                backgroundColor: peer.color,
                borderColor: isMe ? '#fff' : 'transparent',
                opacity: isMe ? 1 : 0.85,
              }}
              title={isMe ? `${peer.name} (you) — click to edit` : peerFile ? `${peer.name} — click to go to ${peerFileName}` : peer.name}
            >
              {peer.name.charAt(0).toUpperCase()}
              {/* Pencil icon overlay on hover (own avatar only) */}
              {isMe && !editing && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <PencilIcon className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            {/* Tooltip */}
            {!editing && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {isMe ? `${peer.name} (you)` : peerFile ? `${peer.name} → ${peerFileName}` : peer.name}
              </div>
            )}
            {/* Inline edit popover (own avatar) */}
            {isMe && editing && (
              <div ref={popoverRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-[#1e2030] border border-zinc-700 rounded-lg shadow-xl p-2 space-y-2 min-w-[140px]">
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.slice(0, 20))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="w-full px-2 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded text-white outline-none focus:border-emerald-400"
                  placeholder="Your name"
                />
                <div className="grid grid-cols-5 gap-1">
                  {peerColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setUserColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${
                        c === userColor ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
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

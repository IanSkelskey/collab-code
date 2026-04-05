import { useEffect, useRef, useState } from 'react';
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
            className="group relative"
          >
            <div
              onClick={isMe ? handleStartEdit : peerFile ? () => handleGoToPeer(peerFile) : undefined}
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white sm:h-7 sm:w-7 sm:text-xs ${
                isMe || peerFile ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{
                backgroundColor: peer.color,
                borderColor: isMe ? '#fff' : 'transparent',
                opacity: isMe ? 1 : 0.85,
              }}
              title={isMe ? `${peer.name} (you) - click to edit` : peerFile ? `${peer.name} - click to go to ${peerFileName}` : peer.name}
            >
              {peer.name.charAt(0).toUpperCase()}
              {isMe && !editing && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[var(--cc-backdrop)] opacity-0 transition-opacity group-hover:opacity-100">
                  <PencilIcon className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            {!editing && (
              <div className="cc-menu cc-text-primary pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                {isMe ? `${peer.name} (you)` : peerFile ? `${peer.name} -> ${peerFileName}` : peer.name}
              </div>
            )}

            {isMe && editing && (
              <div ref={popoverRef} className="cc-menu absolute top-full left-1/2 z-50 mt-1 min-w-[140px] -translate-x-1/2 space-y-2 rounded-lg p-2">
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

import { useCallback, useRef, useEffect, useState } from 'react';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { useCollab } from '../context/CollabContext';
import { getIconColor } from '../config/languages';

/** Peer info attached to a tab */
interface PeerOnFile {
  name: string;
  color: string;
  clientId: number;
}

interface TabBarProps {
  fs: VirtualFS;
}

export default function TabBar({ fs }: TabBarProps) {
  const { openTabs, activeFile } = fs;
  const { awareness } = useCollab();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Track which peers are on which files
  const [peersByFile, setPeersByFile] = useState<Map<string, PeerOnFile[]>>(new Map());

  useEffect(() => {
    if (!awareness) return;

    const update = () => {
      const map = new Map<string, PeerOnFile[]>();
      const localId = awareness.clientID;

      awareness.getStates().forEach((state, clientId) => {
        // Skip self
        if (clientId === localId) return;
        const file = state.activeFile as string | undefined;
        const user = state.user as { name: string; color: string } | undefined;
        if (!file || !user) return;

        const list = map.get(file) ?? [];
        list.push({ name: user.name, color: user.color, clientId });
        map.set(file, list);
      });

      setPeersByFile(map);
    };

    awareness.on('change', update);
    update();
    return () => { awareness.off('change', update); };
  }, [awareness]);

  // Scroll active tab into view when it changes
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeFile]);

  const handleClose = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    fs.closeTab(path);
  }, [fs]);

  // Middle-click to close
  const handleAuxClick = useCallback((e: React.MouseEvent, path: string) => {
    if (e.button === 1) {
      e.preventDefault();
      fs.closeTab(path);
    }
  }, [fs]);

  if (openTabs.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="shrink-0 flex items-end bg-[#0d1117] overflow-x-auto overflow-y-hidden scrollbar-none border-b border-zinc-700/50"
    >
      {openTabs.map(path => {
        const name = path.split('/').pop() ?? path;
        const isActive = path === activeFile;
        const peers = peersByFile.get(path) ?? [];

        return (
          <button
            key={path}
            ref={isActive ? activeTabRef : undefined}
            onClick={() => fs.openFile(path)}
            onAuxClick={(e) => handleAuxClick(e, path)}
            title={path.replace('~/', '')}
            className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-r border-zinc-700/30 shrink-0 transition-colors cursor-pointer select-none
              ${isActive
                ? 'bg-[#1e1e2e] text-zinc-100 border-b-0'
                : 'bg-[#0d1117] text-zinc-500 hover:text-zinc-300 hover:bg-[#161b22]'
              }
            `}
          >
            {/* Active indicator */}
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-400" />
            )}

            {/* File icon dot */}
            <span className={`w-2 h-2 rounded-full shrink-0 ${getIconColor(name)}`}
              style={{ backgroundColor: 'currentColor', opacity: isActive ? 1 : 0.6 }}
            />

            <span className="truncate max-w-[120px]">{name}</span>

            {/* Peer avatars on this tab */}
            {peers.length > 0 && (
              <span className="flex items-center -space-x-1 ml-0.5">
                {peers.slice(0, 3).map(peer => (
                  <span
                    key={peer.clientId}
                    title={peer.name}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white ring-1 ring-zinc-800"
                    style={{ backgroundColor: peer.color }}
                  >
                    {peer.name.charAt(0).toUpperCase()}
                  </span>
                ))}
                {peers.length > 3 && (
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-zinc-300 bg-zinc-600 ring-1 ring-zinc-800">
                    +{peers.length - 3}
                  </span>
                )}
              </span>
            )}

            {/* Close button */}
            <span
              onClick={(e) => handleClose(e, path)}
              className={`ml-0.5 p-0.5 rounded hover:bg-zinc-600/60 transition-colors
                ${isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}
              `}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}

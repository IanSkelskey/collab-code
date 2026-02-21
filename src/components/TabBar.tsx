import { useCallback, useRef, useEffect, useState } from 'react';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { getIconColor } from '../config/languages';
import usePeers from '../hooks/usePeers';
import { CloseIcon } from './Icons';

interface TabBarProps {
  fs: VirtualFS;
}

interface CtxMenu {
  x: number;
  y: number;
  path: string;
}

export default function TabBar({ fs }: TabBarProps) {
  const { openTabs, activeFile } = fs;
  const { peersByFile } = usePeers();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  // Scroll active tab into view when it changes
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeFile]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = () => setCtxMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [ctxMenu]);

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

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, path });
  }, []);

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
            onContextMenu={(e) => handleContextMenu(e, path)}
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
              <CloseIcon className="w-3 h-3" />
            </span>
          </button>
        );
      })}

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 bg-[#1e1e2e] border border-zinc-700 rounded shadow-xl py-1 text-xs text-zinc-300 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={() => setCtxMenu(null)}
        >
          <button className="w-full text-left px-3 py-1.5 hover:bg-zinc-700/50 cursor-pointer" onClick={() => fs.closeTab(ctxMenu.path)}>
            Close
          </button>
          <button className="w-full text-left px-3 py-1.5 hover:bg-zinc-700/50 cursor-pointer" onClick={() => fs.closeOtherTabs(ctxMenu.path)}>
            Close Others
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-700/50 cursor-pointer"
            onClick={() => fs.closeTabsToRight(ctxMenu.path)}
            disabled={openTabs.indexOf(ctxMenu.path) === openTabs.length - 1}
          >
            Close to the Right
          </button>
          <div className="border-t border-zinc-700 my-1" />
          <button className="w-full text-left px-3 py-1.5 hover:bg-zinc-700/50 cursor-pointer" onClick={() => fs.closeAllTabs()}>
            Close All
          </button>
        </div>
      )}
    </div>
  );
}

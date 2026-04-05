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
      className="cc-sidebar-shell cc-divider scrollbar-none flex shrink-0 items-end overflow-x-auto overflow-y-hidden border-b"
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
            className={`cc-divider group relative flex shrink-0 cursor-pointer select-none items-center gap-1.5 border-r px-3 py-1.5 text-xs font-medium transition-colors
              ${isActive
                ? 'bg-[var(--cc-bg-panel-alt)] text-[var(--cc-text-primary)]'
                : 'cc-text-muted hover:bg-[var(--cc-bg-hover)] hover:text-[var(--cc-text-primary)]'
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
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-white ring-1 ring-[var(--cc-bg-panel)]"
                    style={{ backgroundColor: peer.color }}
                  >
                    {peer.name.charAt(0).toUpperCase()}
                  </span>
                ))}
                {peers.length > 3 && (
                  <span className="cc-text-secondary flex h-4 w-4 items-center justify-center rounded-full bg-[var(--cc-border-strong)] text-[7px] font-bold ring-1 ring-[var(--cc-bg-panel)]">
                    +{peers.length - 3}
                  </span>
                )}
              </span>
            )}

            {/* Close button */}
            <span
              onClick={(e) => handleClose(e, path)}
              className={`ml-0.5 rounded p-0.5 transition-colors hover:bg-[var(--cc-bg-hover-strong)]
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
          className="cc-menu cc-text-secondary fixed z-50 min-w-[160px] rounded py-1 text-xs"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={() => setCtxMenu(null)}
        >
          <button className="hover:bg-[var(--cc-bg-hover)] w-full cursor-pointer px-3 py-1.5 text-left" onClick={() => fs.closeTab(ctxMenu.path)}>
            Close
          </button>
          <button className="hover:bg-[var(--cc-bg-hover)] w-full cursor-pointer px-3 py-1.5 text-left" onClick={() => fs.closeOtherTabs(ctxMenu.path)}>
            Close Others
          </button>
          <button
            className="hover:bg-[var(--cc-bg-hover)] w-full cursor-pointer px-3 py-1.5 text-left"
            onClick={() => fs.closeTabsToRight(ctxMenu.path)}
            disabled={openTabs.indexOf(ctxMenu.path) === openTabs.length - 1}
          >
            Close to the Right
          </button>
          <div className="cc-divider my-1 border-t" />
          <button className="hover:bg-[var(--cc-bg-hover)] w-full cursor-pointer px-3 py-1.5 text-left" onClick={() => fs.closeAllTabs()}>
            Close All
          </button>
        </div>
      )}
    </div>
  );
}

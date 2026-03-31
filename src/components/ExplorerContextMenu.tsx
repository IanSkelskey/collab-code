import { useEffect, useRef } from 'react';
import type { ExplorerContextMenuItem } from '../types/fileExplorer';

interface ExplorerContextMenuProps {
  x: number;
  y: number;
  items: ExplorerContextMenuItem[];
  onClose: () => void;
}

export default function ExplorerContextMenu({
  x,
  y,
  items,
  onClose,
}: ExplorerContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[#1e2030] border border-zinc-700 rounded-md shadow-xl py-1 min-w-[140px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-700 transition-colors ${
            item.danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

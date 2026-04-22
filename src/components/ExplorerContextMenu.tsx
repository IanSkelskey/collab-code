import { useEffect, useRef } from 'react';
import type { ExplorerContextMenuItem } from '../types/fileExplorer';

interface ExplorerContextMenuProps {
  x: number;
  y: number;
  items: ExplorerContextMenuItem[];
  onClose: () => void;
}

export default function ExplorerContextMenu({ x, y, items, onClose }: ExplorerContextMenuProps) {
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
      className="cc-menu fixed z-50 min-w-[140px] rounded-md py-1"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--cc-bg-hover)] ${
            item.danger ? 'text-[var(--cc-danger)]' : 'cc-text-primary'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

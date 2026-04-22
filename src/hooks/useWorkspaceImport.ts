import { useCallback, useRef, useState, type DragEvent } from 'react';
import { importDataTransfer } from '../services/importDrop';
import type { VirtualFS } from './useVirtualFS';

interface UseWorkspaceImportOptions {
  fs: VirtualFS;
  pushToast: (label: string) => void;
}

export function useWorkspaceImport({ fs, pushToast }: UseWorkspaceImportOptions) {
  const [osDragActive, setOsDragActive] = useState(false);
  const dragCounter = useRef(0);

  const onOsDragEnter = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    dragCounter.current += 1;
    setOsDragActive(true);
  }, []);

  const onOsDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onOsDragLeave = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setOsDragActive(false);
    }
  }, []);

  const onOsDrop = useCallback(
    async (event: DragEvent) => {
      if (!event.dataTransfer.types.includes('Files')) return;

      event.preventDefault();
      dragCounter.current = 0;
      setOsDragActive(false);

      const importedCount = await importDataTransfer(fs, event.dataTransfer, '~');
      if (importedCount > 0) {
        pushToast(importedCount === 1 ? 'Imported 1 file' : `Imported ${importedCount} files`);
      }
    },
    [fs, pushToast],
  );

  return {
    osDragActive,
    dragHandlers: {
      onDragEnter: onOsDragEnter,
      onDragOver: onOsDragOver,
      onDragLeave: onOsDragLeave,
      onDrop: onOsDrop,
    },
  };
}

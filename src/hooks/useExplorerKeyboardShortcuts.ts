import { useEffect } from 'react';
import type { ExplorerCreateState } from '../types/fileExplorer';

interface UseExplorerKeyboardShortcutsOptions {
  hasSelection: boolean;
  renaming: string | null;
  creating: ExplorerCreateState | null;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDeleteSelection: () => void;
  onClearSelection: () => void;
}

export function useExplorerKeyboardShortcuts({
  hasSelection,
  renaming,
  creating,
  onCreateFile,
  onCreateFolder,
  onDeleteSelection,
  onClearSelection,
}: UseExplorerKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        if (event.shiftKey) {
          onCreateFolder();
        } else {
          onCreateFile();
        }
        return;
      }

      if (event.key === 'Delete' && !renaming && !creating && hasSelection) {
        event.preventDefault();
        onDeleteSelection();
        return;
      }

      if (event.key === 'Escape' && hasSelection) {
        onClearSelection();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    creating,
    hasSelection,
    onClearSelection,
    onCreateFile,
    onCreateFolder,
    onDeleteSelection,
    renaming,
  ]);
}

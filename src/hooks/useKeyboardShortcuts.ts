import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  setExplorerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setTerminalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchVisible: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveFile: () => void;
  handleSaveAll: () => Promise<void>;
}

export function useKeyboardShortcuts({
  setExplorerVisible,
  setTerminalVisible,
  setSearchVisible,
  handleSaveFile,
  handleSaveAll,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setExplorerVisible(v => {
          if (!v) setSearchVisible(false);
          return !v;
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setTerminalVisible(v => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchVisible(v => {
          if (!v) setExplorerVisible(false);
          return !v;
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAll();
        } else {
          handleSaveFile();
        }
      }
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setExplorerVisible(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setExplorerVisible, setTerminalVisible, setSearchVisible, handleSaveFile, handleSaveAll]);
}

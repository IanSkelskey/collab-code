import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { EditorHandle } from '../components/Editor';
import { isMarkdownFile } from '../config/languages';
import { useDragResize } from './useDragResize';
import type { VirtualFS } from './useVirtualFS';

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  secondaryLabel?: string;
  onConfirm: () => void;
  onSecondary?: () => void;
}

interface UseWorkspaceLayoutOptions {
  fs: VirtualFS;
  editorRef: RefObject<EditorHandle | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  pushToast: (label: string) => void;
}

export type MarkdownViewMode = 'write' | 'split' | 'preview';

export function useWorkspaceLayout({
  fs,
  editorRef,
  containerRef,
  pushToast,
}: UseWorkspaceLayoutOptions) {
  const [fontSize, setFontSize] = useState(window.innerWidth < 640 ? 12 : 14);
  const [explorerVisible, setExplorerVisible] = useState(() => window.innerWidth >= 768);
  const [explorerWidth, setExplorerWidth] = useState(() => (window.innerWidth < 640 ? 160 : 200));
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [markdownViewMode, setMarkdownViewMode] = useState<MarkdownViewMode>(() => (
    window.innerWidth < 960 ? 'write' : 'split'
  ));
  const pendingNavigationRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingNavigationRef.current !== null) {
        window.clearTimeout(pendingNavigationRef.current);
      }
    };
  }, []);

  const requestConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => {
    setConfirmDialog({ title, message, onConfirm, confirmLabel });
  }, []);

  const { onDragStart: handleExplorerDragStart } = useDragResize({
    axis: 'horizontal',
    value: explorerWidth,
    setValue: setExplorerWidth,
    min: 120,
    max: 400,
  });

  const { onDragStart: handleTerminalDragStart } = useDragResize({
    axis: 'vertical',
    value: terminalHeight,
    setValue: setTerminalHeight,
    min: 80,
    max: () => (containerRef.current?.clientHeight ?? 720) - 120,
  });

  const handleFormat = useCallback(() => {
    if (!editorRef.current) {
      pushToast('Open the editor pane to format this file');
      return;
    }

    editorRef.current.format();
    pushToast('Document formatted');
  }, [editorRef, pushToast]);

  const handleToggleExplorer = useCallback(() => {
    setExplorerVisible((isVisible) => {
      if (!isVisible) {
        setSearchVisible(false);
      }

      return !isVisible;
    });
  }, []);

  const handleToggleTerminal = useCallback(() => {
    setTerminalVisible((isVisible) => !isVisible);
  }, []);

  const handleToggleSearch = useCallback(() => {
    setSearchVisible((isVisible) => {
      if (!isVisible) {
        setExplorerVisible(false);
      }

      return !isVisible;
    });
  }, []);

  const navigateToFile = useCallback((file: string, line?: number, col?: number) => {
    if (pendingNavigationRef.current !== null) {
      window.clearTimeout(pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }

    const shouldOpenEditor = isMarkdownFile(file) && markdownViewMode === 'preview';
    if (shouldOpenEditor) {
      setMarkdownViewMode('write');
    }

    const hasPosition = typeof line === 'number' && typeof col === 'number';

    if (fs.activeFile === file && !shouldOpenEditor) {
      if (hasPosition) {
        editorRef.current?.revealLine(line, col);
      }
      return;
    }

    if (fs.activeFile !== file) {
      fs.openFile(file);
    }

    if (!hasPosition) {
      return;
    }

    pendingNavigationRef.current = window.setTimeout(() => {
      editorRef.current?.revealLine(line, col);
      pendingNavigationRef.current = null;
    }, shouldOpenEditor ? 140 : 100);
  }, [editorRef, fs, markdownViewMode]);

  const handleFontSizeUp = useCallback(() => {
    setFontSize((currentFontSize) => {
      const nextFontSize = Math.min(currentFontSize + 2, 28);
      pushToast(`Font size: ${nextFontSize}`);
      return nextFontSize;
    });
  }, [pushToast]);

  const handleFontSizeDown = useCallback(() => {
    setFontSize((currentFontSize) => {
      const nextFontSize = Math.max(currentFontSize - 2, 8);
      pushToast(`Font size: ${nextFontSize}`);
      return nextFontSize;
    });
  }, [pushToast]);

  return {
    fontSize,
    explorerVisible,
    explorerWidth,
    terminalVisible,
    terminalHeight,
    helpOpen,
    searchVisible,
    confirmDialog,
    markdownViewMode,
    setTerminalVisible,
    setHelpOpen,
    setSearchVisible,
    setExplorerVisible,
    setConfirmDialog,
    setMarkdownViewMode,
    requestConfirm,
    handleExplorerDragStart,
    handleTerminalDragStart,
    handleFormat,
    handleToggleExplorer,
    handleToggleTerminal,
    handleToggleSearch,
    navigateToFile,
    handleFontSizeUp,
    handleFontSizeDown,
  };
}

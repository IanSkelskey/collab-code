import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useCollab } from '../context/CollabContext';
import type { RoomTemplateId } from '../config/roomTemplates';
import { isMarkdownFile } from '../config/languages';
import { useAudioPreferences } from './useAudioPreferences';
import { useExecution } from './useExecution';
import { useFileExport } from './useFileExport';
import { useFollowCollaborator } from './useFollowCollaborator';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { usePeerPresenceToasts } from './usePeerPresenceToasts';
import { useServerStatus } from './useServerStatus';
import { useToast } from './useToast';
import { useVirtualFS } from './useVirtualFS';
import { useWorkspaceImport } from './useWorkspaceImport';
import { useWorkspaceLayout } from './useWorkspaceLayout';
import type { EditorHandle } from '../components/Editor';
import type { TerminalHandle } from '../components/Terminal';
import type { HelpModalTab } from '../components/HelpModal';
import { createStarterWorkspaceFiles } from '../lib/workspaceStarter';

interface UseWorkspaceControllerOptions {
  initialRoomTemplate: RoomTemplateId | null;
}

export function useWorkspaceController({ initialRoomTemplate }: UseWorkspaceControllerOptions) {
  const { ydoc, peerCount, roomId, connected, connectionStatus, awareness, storageReady } =
    useCollab();
  const fs = useVirtualFS(ydoc, { storageReady, initialRoomTemplate, roomId });
  const terminalRef = useRef<TerminalHandle>(null);
  const editorRef = useRef<EditorHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markdownSplitContainerRef = useRef<HTMLDivElement>(null);
  const [dismissedServerBannerKey, setDismissedServerBannerKey] = useState<string | null>(null);
  const [helpInitialTab, setHelpInitialTab] = useState<HelpModalTab>('about');
  const { toasts, pushToast, dismissToast } = useToast();
  const {
    presenceSoundsEnabled,
    presenceSoundVolume,
    setPresenceSoundsEnabled,
    setPresenceSoundVolume,
  } = useAudioPreferences();

  const layout = useWorkspaceLayout({
    fs,
    editorRef,
    containerRef,
    markdownSplitContainerRef,
    pushToast,
  });

  const { peers, followedPeer, followedPeerId, toggleFollowPeer, stopFollowing } =
    useFollowCollaborator({
      awareness,
      ydoc,
      fs,
      pushToast,
      navigateToFile: layout.navigateToFile,
    });

  const {
    running,
    entryPoints,
    runnableTargets,
    currentRunTarget,
    handleRun,
    handleRunActiveFile,
  } = useExecution({
    ydoc,
    fs,
    terminalRef,
    editorRef,
    setTerminalVisible: layout.setTerminalVisible,
  });

  const { codeCopied, handleCopyCode, handleSaveFile, handleSaveAll } = useFileExport({
    fs,
    roomId,
    editorRef,
    pushToast,
  });

  const { osDragActive, dragHandlers } = useWorkspaceImport({ fs, pushToast });
  const serverStatus = useServerStatus({ syncStatus: connectionStatus });
  const markdownActive = isMarkdownFile(fs.activeFile);
  const markdownContent = fs.activeFile ? (fs.readFile(fs.activeFile) ?? '') : '';
  const showMarkdownEditor = !markdownActive || layout.markdownViewMode !== 'preview';
  const showMarkdownPreview = markdownActive && layout.markdownViewMode !== 'write';
  const editorLockLabel = followedPeer ? `Following ${followedPeer.name}` : null;
  const markdownSplitStyle =
    showMarkdownEditor && showMarkdownPreview && layout.markdownViewMode === 'split'
      ? ({ '--cc-markdown-editor-width': `${layout.markdownEditorWidth}px` } as CSSProperties)
      : undefined;
  const activeFileName = fs.activeFile ? (fs.activeFile.split('/').pop() ?? null) : null;

  const handleFormatCompleted = useCallback(() => {
    pushToast('Document formatted');
  }, [pushToast]);

  const handleCreateStarterFile = useCallback(
    (templateId: Exclude<RoomTemplateId, 'blank'>) => {
      const createdWorkspace = createStarterWorkspaceFiles(fs, templateId);
      if (!createdWorkspace) {
        return;
      }

      pushToast(`Created ${createdWorkspace.createdNames}`);
    },
    [fs, pushToast],
  );

  useKeyboardShortcuts({
    setExplorerVisible: layout.setExplorerVisible,
    setTerminalVisible: layout.setTerminalVisible,
    setSearchVisible: layout.setSearchVisible,
    handleSaveFile,
    handleSaveAll,
  });

  usePeerPresenceToasts({
    awareness,
    connected,
    pushToast,
    presenceSoundsEnabled,
    presenceSoundVolume,
  });

  const openHelp = useCallback(
    (tab: HelpModalTab = 'about') => {
      setHelpInitialTab(tab);
      layout.setHelpOpen(true);
    },
    [layout],
  );

  const openAboutHelp = useCallback(() => {
    openHelp('about');
  }, [openHelp]);

  const openServerHelp = useCallback(() => {
    openHelp('server');
  }, [openHelp]);

  const dismissServerBanner = useCallback(() => {
    setDismissedServerBannerKey(serverStatus.banner?.key ?? null);
  }, [serverStatus.banner]);

  useEffect(() => {
    if (!serverStatus.banner) {
      setDismissedServerBannerKey(null);
      return;
    }

    setDismissedServerBannerKey((current) =>
      current === serverStatus.banner?.key ? current : null,
    );
  }, [serverStatus.banner]);

  useEffect(() => {
    if (!awareness) {
      return;
    }

    awareness.setLocalStateField('activeFile', fs.activeFile);
  }, [awareness, fs.activeFile]);

  const activeServerBanner =
    serverStatus.banner && dismissedServerBannerKey !== serverStatus.banner.key
      ? serverStatus.banner
      : null;

  return {
    fs,
    roomId,
    peerCount,
    peers,
    followedPeer,
    followedPeerId,
    running,
    entryPoints,
    runnableTargets,
    currentRunTarget,
    serverStatus,
    pushToast,
    toasts,
    dismissToast,
    codeCopied,
    activeFileName,
    terminalRef,
    editorRef,
    containerRef,
    markdownSplitContainerRef,
    dragHandlers,
    osDragActive,
    layout,
    helpInitialTab,
    activeServerBanner,
    markdownActive,
    markdownContent,
    showMarkdownEditor,
    showMarkdownPreview,
    editorLockLabel,
    markdownSplitStyle,
    presenceSoundsEnabled,
    presenceSoundVolume,
    setPresenceSoundsEnabled,
    setPresenceSoundVolume,
    handleRun,
    handleRunActiveFile,
    handleCopyCode,
    handleSaveFile,
    handleSaveAll,
    handleFormatCompleted,
    handleCreateStarterFile,
    toggleFollowPeer,
    stopFollowing,
    openHelp,
    openAboutHelp,
    openServerHelp,
    dismissServerBanner,
  };
}

export type WorkspaceController = ReturnType<typeof useWorkspaceController>;

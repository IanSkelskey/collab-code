import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import type { EditorHandle } from '../components/Editor';
import type { VirtualFS } from './useVirtualFS';
import { getMimeType } from '../config/languages';
import JSZip from 'jszip';

interface UseFileExportOptions {
  fs: VirtualFS;
  roomId: string;
  editorRef: RefObject<EditorHandle | null>;
  pushToast: (label: string) => void;
}

export function useFileExport({ fs, roomId, editorRef, pushToast }: UseFileExportOptions) {
  const [codeCopied, setCodeCopied] = useState(false);

  const getActiveCode = useCallback(() => {
    if (fs.activeFile) {
      return fs.readFile(fs.activeFile) ?? '';
    }

    return editorRef.current?.getCode() ?? '';
  }, [editorRef, fs]);

  const handleCopyCode = useCallback(async () => {
    const code = getActiveCode();
    if (!code.trim()) return;
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      const fileName = fs.activeFile?.split('/').pop() ?? 'code';
      pushToast(`Copied ${fileName} to clipboard`);
    } catch {
      prompt('Copy this code:', code);
    }
  }, [fs.activeFile, getActiveCode, pushToast]);

  const handleSaveFile = useCallback(() => {
    const code = getActiveCode();
    if (!code.trim()) return;
    const activeName = fs.activeFile?.split('/').pop() ?? 'code.txt';
    const blob = new Blob([code], { type: getMimeType(activeName) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast(`Downloaded ${activeName}`);
  }, [fs.activeFile, getActiveCode, pushToast]);

  const handleSaveAll = useCallback(async () => {
    const allFiles = fs.getAllFiles();
    const fileNames = Object.keys(allFiles);
    if (fileNames.length === 0) return;

    const zip = new JSZip();
    for (const [relPath, content] of Object.entries(allFiles)) {
      zip.file(relPath, content);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collab-code-${roomId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast(`Downloaded collab-code-${roomId}.zip`);
  }, [fs, roomId, pushToast]);

  return { codeCopied, handleCopyCode, handleSaveFile, handleSaveAll };
}

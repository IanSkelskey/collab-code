import { useEffect, type MutableRefObject } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface UseEditorContextMenuPasteOptions {
  monacoEditor: editor.IStandaloneCodeEditor | null;
  monacoRef: MutableRefObject<Monaco | null>;
}

// Monaco's built-in context-menu "Paste" runs document.execCommand('paste'),
// which browsers block from script, so the menu entry silently does nothing.
// Overriding the command id makes the existing menu entry read via the async
// Clipboard API instead. Ctrl+V is untouched — the browser dispatches a native
// paste event for it.
export function useEditorContextMenuPaste({
  monacoEditor,
  monacoRef,
}: UseEditorContextMenuPasteOptions): void {
  useEffect(() => {
    const editorInstance = monacoEditor;
    const monaco = monacoRef.current;
    if (!editorInstance || !monaco) return;

    const disposable = monaco.editor.addCommand({
      id: 'editor.action.clipboardPasteAction',
      run: () => {
        void navigator.clipboard
          .readText()
          .then((text) => {
            if (!text) return;
            editorInstance.focus();
            editorInstance.trigger('keyboard', 'paste', { text });
          })
          .catch(() => {});
      },
    });

    return () => disposable.dispose();
  }, [monacoEditor, monacoRef]);
}

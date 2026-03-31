import { useEffect, useEffectEvent, type MutableRefObject } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface UseEditorActionsOptions {
  monacoEditor: editor.IStandaloneCodeEditor | null;
  monacoRef: MutableRefObject<Monaco | null>;
  onRun?: () => void;
  onFormat?: () => void;
}

export function useEditorActions({
  monacoEditor,
  monacoRef,
  onRun,
  onFormat,
}: UseEditorActionsOptions): void {
  const invokeRun = useEffectEvent(() => {
    onRun?.();
  });

  const invokeFormat = useEffectEvent(() => {
    onFormat?.();
  });

  useEffect(() => {
    const editorInstance = monacoEditor;
    const monaco = monacoRef.current;
    if (!editorInstance || !monaco) return;

    const disposable = editorInstance.addAction({
      id: 'collab-code-run',
      label: 'Run Code (Ctrl+Enter)',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        invokeRun();
      },
    });

    return () => disposable.dispose();
  }, [invokeRun, monacoEditor, monacoRef]);

  useEffect(() => {
    const editorInstance = monacoEditor;
    const monaco = monacoRef.current;
    if (!editorInstance || !monaco) return;

    const disposable = editorInstance.addAction({
      id: 'collab-code-format',
      label: 'Format Document (Alt+Shift+F)',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: async (activeEditor) => {
        await activeEditor.getAction('editor.action.formatDocument')?.run();
        invokeFormat();
      },
    });

    return () => disposable.dispose();
  }, [invokeFormat, monacoEditor, monacoRef]);
}

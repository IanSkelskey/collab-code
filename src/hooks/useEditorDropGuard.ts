import { useEffect } from 'react';
import type { editor } from 'monaco-editor';

export function useEditorDropGuard(monacoEditor: editor.IStandaloneCodeEditor | null): void {
  useEffect(() => {
    if (!monacoEditor) return;

    const domNode = monacoEditor.getDomNode();
    if (!domNode) return;

    const preventDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const showNoDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }
    };

    domNode.addEventListener('dragover', showNoDrop, true);
    domNode.addEventListener('drop', preventDrop, true);

    return () => {
      domNode.removeEventListener('dragover', showNoDrop, true);
      domNode.removeEventListener('drop', preventDrop, true);
    };
  }, [monacoEditor]);
}

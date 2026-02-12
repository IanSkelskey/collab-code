import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import type { editor } from 'monaco-editor';
import { useCollab } from '../context/CollabContext';

const DEFAULT_CODE = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Collab Code!");
    }
}
`;

export interface EditorHandle {
  getCode: () => string;
}

const Editor = forwardRef<EditorHandle>(function Editor(_props, ref) {
  const { ydoc, awareness } = useCollab();
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  useImperativeHandle(ref, () => ({
    getCode: () => monacoEditor?.getModel()?.getValue() ?? '',
  }), [monacoEditor]);

  const handleMount: OnMount = useCallback((ed) => {
    setMonacoEditor(ed);
  }, []);

  // Create the Yjs <-> Monaco binding once both editor AND awareness are ready
  useEffect(() => {
    if (!monacoEditor || !awareness) return;

    const ytext = ydoc.getText('code');

    // Create the Yjs <-> Monaco binding
    const binding = new MonacoBinding(
      ytext,
      monacoEditor.getModel()!,
      new Set([monacoEditor]),
      awareness
    );
    bindingRef.current = binding;

    // Wait a moment for sync from existing peers before seeding default code.
    // If a peer sends us their document state, ytext won't be empty anymore.
    const seedTimeout = setTimeout(() => {
      if (ytext.length === 0) {
        ytext.insert(0, DEFAULT_CODE);
      }
    }, 1500);

    return () => {
      clearTimeout(seedTimeout);
      binding.destroy();
      bindingRef.current = null;
    };
  }, [monacoEditor, awareness, ydoc]);

  return (
    <div className="h-full w-full">
      <MonacoEditor
        defaultLanguage="java"
        theme="vs-dark"
        onMount={handleMount}
        options={{
          fontSize: window.innerWidth < 640 ? 12 : 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 8 },
          wordWrap: 'on',
          tabSize: 4,
          insertSpaces: true,
          lineNumbers: window.innerWidth < 480 ? 'off' : 'on',
          folding: window.innerWidth >= 640,
          glyphMargin: false,
          lineDecorationsWidth: window.innerWidth < 640 ? 4 : 10,
        }}
        loading={
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
            Loading editor...
          </div>
        }
      />
    </div>
  );
});

export default Editor;

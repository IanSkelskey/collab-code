import { useState, useEffect, useCallback, useRef } from 'react';
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

export default function Editor() {
  const { ydoc, awareness } = useCollab();
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  const handleMount: OnMount = useCallback((ed) => {
    setMonacoEditor(ed);
  }, []);

  // Create the Yjs <-> Monaco binding once both editor AND awareness are ready
  useEffect(() => {
    if (!monacoEditor || !awareness) return;

    const ytext = ydoc.getText('code');

    // Seed with default code only if the doc is empty
    if (ytext.length === 0) {
      ytext.insert(0, DEFAULT_CODE);
    }

    // Create the Yjs <-> Monaco binding
    const binding = new MonacoBinding(
      ytext,
      monacoEditor.getModel()!,
      new Set([monacoEditor]),
      awareness
    );
    bindingRef.current = binding;

    return () => {
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
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12 },
          wordWrap: 'on',
          tabSize: 4,
          insertSpaces: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full text-zinc-400">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}

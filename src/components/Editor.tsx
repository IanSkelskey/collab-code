import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import MonacoEditor, { type OnMount, type Monaco } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import type { editor } from 'monaco-editor';
import { useCollab } from '../context/CollabContext';
import type { DiagnosticMarker } from '../services/javaDiagnostics';

const DEFAULT_CODE = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Collab Code!");
    }
}
`;

export interface EditorHandle {
  getCode: () => string;
  setMarkers: (markers: DiagnosticMarker[]) => void;
  clearMarkers: () => void;
}

interface EditorProps {
  onRun?: () => void;
  fontSize?: number;
}

const MARKER_OWNER = 'collab-code-diagnostics';

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ onRun, fontSize = 14 }, ref) {
  const { ydoc, awareness } = useCollab();
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  // Keep a stable ref for the run callback to avoid re-registering keybinding
  const onRunRef = useRef(onRun);
  useEffect(() => { onRunRef.current = onRun; }, [onRun]);

  useImperativeHandle(ref, () => ({
    getCode: () => monacoEditor?.getModel()?.getValue() ?? '',
    setMarkers: (markers: DiagnosticMarker[]) => {
      const monaco = monacoRef.current;
      const model = monacoEditor?.getModel();
      if (!monaco || !model) return;
      monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
    },
    clearMarkers: () => {
      const monaco = monacoRef.current;
      const model = monacoEditor?.getModel();
      if (!monaco || !model) return;
      monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
    },
  }), [monacoEditor]);

  const handleMount: OnMount = useCallback((ed, monaco) => {
    setMonacoEditor(ed);
    monacoRef.current = monaco;
  }, []);

  // Ctrl+Enter to run code
  useEffect(() => {
    const ed = monacoEditor;
    const m = monacoRef.current;
    if (!ed || !m) return;
    const disposable = ed.addAction({
      id: 'collab-code-run',
      label: 'Run Code (Ctrl+Enter)',
      keybindings: [m.KeyMod.CtrlCmd | m.KeyCode.Enter],
      run: () => { onRunRef.current?.(); },
    });
    return () => disposable.dispose();
  }, [monacoEditor]);

  // Update font size dynamically
  useEffect(() => {
    if (!monacoEditor) return;
    monacoEditor.updateOptions({ fontSize });
  }, [monacoEditor, fontSize]);

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
          fontSize,
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

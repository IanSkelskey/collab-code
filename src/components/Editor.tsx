import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import MonacoEditor, { type OnMount, type Monaco } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import type { editor } from 'monaco-editor';
import { useCollab } from '../context/CollabContext';
import type { DiagnosticMarker } from '../services/javaDiagnostics';
import type { VirtualFS } from '../hooks/useVirtualFS';

export interface EditorHandle {
  getCode: () => string;
  setMarkers: (markers: DiagnosticMarker[]) => void;
  clearMarkers: () => void;
}

interface EditorProps {
  onRun?: () => void;
  fontSize?: number;
  fs?: VirtualFS;
}

const MARKER_OWNER = 'collab-code-diagnostics';

/** Derive Monaco language from file extension */
function languageForFile(path: string): string {
  if (path.endsWith('.java')) return 'java';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.js') || path.endsWith('.mjs')) return 'javascript';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.xml')) return 'xml';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.c') || path.endsWith('.h')) return 'c';
  if (path.endsWith('.cpp') || path.endsWith('.hpp')) return 'cpp';
  return 'plaintext';
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ onRun, fontSize = 14, fs }, ref) {
  const { ydoc, awareness } = useCollab();
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  // Keep a stable ref for the run callback to avoid re-registering keybinding
  const onRunRef = useRef(onRun);
  useEffect(() => { onRunRef.current = onRun; }, [onRun]);

  // Track the file path currently bound to the editor
  const boundFileRef = useRef<string | null>(null);

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

  // Bind to the active file's Y.Text (or fall back to legacy Y.Text('code'))
  const activeFile = fs?.activeFile ?? null;

  useEffect(() => {
    if (!monacoEditor || !awareness) return;

    // Determine which Y.Text to bind
    let ytext: import('yjs').Text;
    let filePath: string | null = null;

    if (fs && activeFile && fs.getFileText(activeFile)) {
      ytext = fs.getFileText(activeFile)!;
      filePath = activeFile;
    } else {
      // Legacy fallback — single file mode
      ytext = ydoc.getText('code');
      filePath = null;
    }

    // Don't re-bind if we're already bound to this file
    if (boundFileRef.current === filePath && bindingRef.current) return;

    // Clean up previous binding
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    // Set language based on file extension
    const model = monacoEditor.getModel();
    if (model && filePath) {
      const lang = languageForFile(filePath);
      monacoRef.current?.editor.setModelLanguage(model, lang);
    }

    // Create new binding
    const binding = new MonacoBinding(
      ytext,
      monacoEditor.getModel()!,
      new Set([monacoEditor]),
      awareness
    );
    bindingRef.current = binding;
    boundFileRef.current = filePath;

    return () => {
      binding.destroy();
      bindingRef.current = null;
      boundFileRef.current = null;
    };
  }, [monacoEditor, awareness, ydoc, activeFile, fs]);

  // Prevent external drag-and-drop (e.g. from file explorer) inserting text into the editor
  useEffect(() => {
    if (!monacoEditor) return;
    const dom = monacoEditor.getDomNode();
    if (!dom) return;
    const preventDrop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const showNoDrop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'; };
    dom.addEventListener('dragover', showNoDrop, true);
    dom.addEventListener('drop', preventDrop, true);
    return () => {
      dom.removeEventListener('dragover', showNoDrop, true);
      dom.removeEventListener('drop', preventDrop, true);
    };
  }, [monacoEditor]);

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
          dragAndDrop: false,
          dropIntoEditor: { enabled: false },
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

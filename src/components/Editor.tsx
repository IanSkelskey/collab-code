import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import MonacoEditor, { type OnMount, type Monaco } from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import type { editor } from 'monaco-editor';
import { useCollab } from '../context/CollabContext';
import { getMonacoLanguage, primaryLanguage, languages } from '../config/languages';
import type { DiagnosticMarker } from '../config/languages';
import type { VirtualFS } from '../hooks/useVirtualFS';

export interface EditorHandle {
  getCode: () => string;
  setMarkers: (markers: DiagnosticMarker[]) => void;
  clearMarkers: () => void;
  format: () => void;
}

interface EditorProps {
  onRun?: () => void;
  onFormat?: () => void;
  fontSize?: number;
  fs?: VirtualFS;
}

const MARKER_OWNER = 'collab-code-diagnostics';

/** Basic brace-based formatter for C-like languages (Java, C, C++) */
function formatBraceCode(text: string, tabSize: number): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let indent = 0;

  for (const rawLine of lines) {
    const stripped = rawLine.trim();

    if (!stripped) {
      result.push('');
      continue;
    }

    // Count leading closing braces to dedent this line
    let leadingCloses = 0;
    for (const ch of stripped) {
      if (ch === '}') leadingCloses++;
      else break;
    }

    const lineIndent = Math.max(0, indent - leadingCloses);
    result.push(' '.repeat(lineIndent * tabSize) + stripped);

    // Update indent for next line
    const opens = (stripped.match(/{/g) || []).length;
    const closes = (stripped.match(/}/g) || []).length;
    indent = Math.max(0, indent + opens - closes);
  }

  return result.join('\n');
}

const registeredFormatters = new Set<string>();

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ onRun, onFormat, fontSize = 14, fs }, ref) {
  const { ydoc, awareness } = useCollab();
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  // Keep a stable ref for the run callback to avoid re-registering keybinding
  const onRunRef = useRef(onRun);
  useEffect(() => { onRunRef.current = onRun; }, [onRun]);

  const onFormatRef = useRef(onFormat);
  useEffect(() => { onFormatRef.current = onFormat; }, [onFormat]);

  // Track the file path currently bound to the editor
  const boundFileRef = useRef<string | null>(null);

  // Keep a stable ref for fs to avoid re-triggering the binding effect
  const fsRef = useRef(fs);
  useEffect(() => { fsRef.current = fs; }, [fs]);

  // Store all diagnostic markers across files so we can re-apply on file switch
  const allMarkersRef = useRef<DiagnosticMarker[]>([]);

  const activeFile = fs?.activeFile ?? null;

  const applyMarkersForFile = useCallback((filePath: string | null) => {
    const monaco = monacoRef.current;
    const model = monacoEditor?.getModel();
    if (!monaco || !model) return;
    const fileName = filePath?.split('/').pop();
    const markers = fileName
      ? allMarkersRef.current.filter(m => !m.file || m.file === fileName)
      : allMarkersRef.current;
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
  }, [monacoEditor]);

  useImperativeHandle(ref, () => ({
    getCode: () => monacoEditor?.getModel()?.getValue() ?? '',
    setMarkers: (markers: DiagnosticMarker[]) => {
      allMarkersRef.current = markers;
      applyMarkersForFile(activeFile);
    },
    clearMarkers: () => {
      allMarkersRef.current = [];
      const monaco = monacoRef.current;
      const model = monacoEditor?.getModel();
      if (!monaco || !model) return;
      monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
    },
    format: () => {
      monacoEditor?.getAction('editor.action.formatDocument')?.run();
    },
  }), [monacoEditor, activeFile, applyMarkersForFile]);

  // Re-apply markers when switching files
  useEffect(() => {
    if (allMarkersRef.current.length > 0) {
      applyMarkersForFile(activeFile);
    }
  }, [activeFile, applyMarkersForFile]);

  const handleMount: OnMount = useCallback((ed, monaco) => {
    setMonacoEditor(ed);
    monacoRef.current = monaco;

    // Register formatting providers for languages without built-in formatters
    for (const lang of languages) {
      if (lang.braceFormatted && !registeredFormatters.has(lang.monacoLanguage)) {
        registeredFormatters.add(lang.monacoLanguage);
        monaco.languages.registerDocumentFormattingEditProvider(lang.monacoLanguage, {
          provideDocumentFormattingEdits(model: editor.ITextModel) {
            const formatted = formatBraceCode(model.getValue(), model.getOptions().tabSize);
            return [{ range: model.getFullModelRange(), text: formatted }];
          },
        });
      }
    }
    if (!registeredFormatters.has('python')) {
      registeredFormatters.add('python');
      monaco.languages.registerDocumentFormattingEditProvider('python', {
        provideDocumentFormattingEdits(model: editor.ITextModel) {
          const formatted = model.getValue().split('\n').map((l: string) => l.trimEnd()).join('\n');
          return [{ range: model.getFullModelRange(), text: formatted }];
        },
      });
    }
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

  // Alt+Shift+F to format document with notification
  useEffect(() => {
    const ed = monacoEditor;
    const m = monacoRef.current;
    if (!ed || !m) return;
    const disposable = ed.addAction({
      id: 'collab-code-format',
      label: 'Format Document (Alt+Shift+F)',
      keybindings: [m.KeyMod.Alt | m.KeyMod.Shift | m.KeyCode.KeyF],
      run: async (editor) => {
        await editor.getAction('editor.action.formatDocument')?.run();
        onFormatRef.current?.();
      },
    });
    return () => disposable.dispose();
  }, [monacoEditor]);

  // Update font size dynamically
  useEffect(() => {
    if (!monacoEditor) return;
    monacoEditor.updateOptions({ fontSize });
  }, [monacoEditor, fontSize]);

  // Bind to the active file's Y.Text (or fall back to legacy Y.Text('code'))

  useEffect(() => {
    if (!monacoEditor || !awareness) return;

    // Determine which Y.Text to bind
    let ytext: import('yjs').Text;
    let filePath: string | null = null;

    const currentFs = fsRef.current;
    if (currentFs && activeFile && currentFs.getFileText(activeFile)) {
      ytext = currentFs.getFileText(activeFile)!;
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
      monacoRef.current?.editor.setModelLanguage(model, getMonacoLanguage(filePath));
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
  }, [monacoEditor, awareness, ydoc, activeFile]);

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
        defaultLanguage={primaryLanguage.monacoLanguage}
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

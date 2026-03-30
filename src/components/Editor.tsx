import {
  forwardRef,
  useCallback,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import MonacoEditor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useCollab } from '../context/CollabContext';
import { primaryLanguage, type DiagnosticMarker } from '../config/languages';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { useEditorBinding } from '../hooks/useEditorBinding';
import { useEditorDiagnostics } from '../hooks/useEditorDiagnostics';
import { useRemoteMonacoSelections } from '../hooks/useRemoteMonacoSelections';
import { registerEditorFormatters } from '../services/editorFormatters';

export interface EditorHandle {
  getCode: () => string;
  setMarkers: (markers: DiagnosticMarker[]) => void;
  clearMarkers: () => void;
  format: () => void;
  revealLine: (line: number, col: number) => void;
}

interface EditorProps {
  onRun?: () => void;
  onFormat?: () => void;
  fontSize?: number;
  fs?: VirtualFS;
}

function getEditorOptions(fontSize: number): editor.IStandaloneEditorConstructionOptions {
  return {
    fontSize,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 28 },
    wordWrap: 'on',
    tabSize: 4,
    insertSpaces: true,
    lineNumbers: window.innerWidth < 480 ? 'off' : 'on',
    folding: window.innerWidth >= 640,
    glyphMargin: false,
    lineDecorationsWidth: window.innerWidth < 640 ? 4 : 10,
    dragAndDrop: false,
    dropIntoEditor: { enabled: false },
  };
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { onRun, onFormat, fontSize = 14, fs },
  ref,
) {
  const { ydoc, awareness } = useCollab();
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const activeFile = fs?.activeFile ?? null;

  const invokeRun = useEffectEvent(() => {
    onRun?.();
  });

  const invokeFormat = useEffectEvent(() => {
    onFormat?.();
  });

  const { getBindingTarget } = useEditorBinding({
    monacoEditor,
    monacoRef,
    ydoc,
    fs,
    activeFile,
  });

  const diagnostics = useEditorDiagnostics({
    monacoEditor,
    monacoRef,
    activeFile,
  });

  useRemoteMonacoSelections({
    monacoEditor,
    monacoRef,
    awareness,
    ydoc,
    getBindingTarget,
  });

  useImperativeHandle(ref, () => diagnostics, [diagnostics]);

  const handleMount: OnMount = useCallback((editorInstance, monaco) => {
    setMonacoEditor(editorInstance);
    monacoRef.current = monaco;
    registerEditorFormatters(monaco);
  }, []);

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
  }, [invokeRun, monacoEditor]);

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
  }, [invokeFormat, monacoEditor]);

  useEffect(() => {
    if (!monacoEditor) return;
    monacoEditor.updateOptions({ fontSize });
  }, [fontSize, monacoEditor]);

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

  const editorOptions = useMemo(() => getEditorOptions(fontSize), [fontSize]);

  return (
    <div className="h-full w-full">
      <MonacoEditor
        defaultLanguage={primaryLanguage.monacoLanguage}
        theme="vs-dark"
        onMount={handleMount}
        options={editorOptions}
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


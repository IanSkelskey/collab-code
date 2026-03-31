import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import MonacoEditor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useCollab } from '../context/CollabContext';
import { primaryLanguage, type DiagnosticMarker } from '../config/languages';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { useEditorActions } from '../hooks/useEditorActions';
import { useEditorBinding } from '../hooks/useEditorBinding';
import { useEditorDiagnostics } from '../hooks/useEditorDiagnostics';
import { useEditorDropGuard } from '../hooks/useEditorDropGuard';
import { useEditorOptions } from '../hooks/useEditorOptions';
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

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { onRun, onFormat, fontSize = 14, fs },
  ref,
) {
  const { ydoc, awareness } = useCollab();
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const activeFile = fs?.activeFile ?? null;
  const editorOptions = useEditorOptions(fontSize);

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

  useEditorActions({
    monacoEditor,
    monacoRef,
    onRun,
    onFormat,
  });
  useEditorDropGuard(monacoEditor);

  useImperativeHandle(ref, () => diagnostics, [diagnostics]);

  const handleMount: OnMount = (editorInstance, monaco) => {
    setMonacoEditor(editorInstance);
    monacoRef.current = monaco;
    registerEditorFormatters(monaco);
  };

  useEffect(() => {
    if (!monacoEditor) return;
    monacoEditor.updateOptions({ fontSize });
  }, [fontSize, monacoEditor]);

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

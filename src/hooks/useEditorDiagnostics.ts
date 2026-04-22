import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { DiagnosticMarker } from '../config/languages';
import { getBaseName } from '../lib/vfsPaths';

const MARKER_OWNER = 'collab-code-diagnostics';

interface UseEditorDiagnosticsOptions {
  monacoEditor: editor.IStandaloneCodeEditor | null;
  monacoRef: MutableRefObject<Monaco | null>;
  activeFile: string | null;
}

export function useEditorDiagnostics({
  monacoEditor,
  monacoRef,
  activeFile,
}: UseEditorDiagnosticsOptions) {
  const allMarkersRef = useRef<DiagnosticMarker[]>([]);

  const applyMarkersForFile = useCallback(
    (filePath: string | null) => {
      const monaco = monacoRef.current;
      const model = monacoEditor?.getModel();
      if (!monaco || !model) return;

      const fileName = filePath ? getBaseName(filePath) : null;
      const nextMarkers = fileName
        ? allMarkersRef.current.filter((marker) => !marker.file || marker.file === fileName)
        : allMarkersRef.current;

      monaco.editor.setModelMarkers(model, MARKER_OWNER, nextMarkers);
    },
    [monacoEditor, monacoRef],
  );

  const clearMarkers = useCallback(() => {
    allMarkersRef.current = [];
    const monaco = monacoRef.current;
    const model = monacoEditor?.getModel();
    if (!monaco || !model) return;

    monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
  }, [monacoEditor, monacoRef]);

  useEffect(() => {
    if (allMarkersRef.current.length > 0) {
      applyMarkersForFile(activeFile);
    }
  }, [activeFile, applyMarkersForFile]);

  return useMemo(
    () => ({
      getCode: () => monacoEditor?.getModel()?.getValue() ?? '',
      setMarkers: (markers: DiagnosticMarker[]) => {
        allMarkersRef.current = markers;
        applyMarkersForFile(activeFile);
      },
      clearMarkers,
      format: () => {
        monacoEditor?.getAction('editor.action.formatDocument')?.run();
      },
      revealLine: (line: number, col: number) => {
        if (!monacoEditor) return;
        monacoEditor.revealLineInCenter(line);
        monacoEditor.setPosition({ lineNumber: line, column: col });
        monacoEditor.focus();
      },
    }),
    [activeFile, applyMarkersForFile, clearMarkers, monacoEditor],
  );
}

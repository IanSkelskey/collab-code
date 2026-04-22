import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
import { useTheme } from '../theme/useTheme';
import { registerMonacoThemes } from '../theme/monacoThemes';
import { CloseIcon, EyeIcon } from './Icons';
import './Editor.css';

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
  interactionLockedLabel?: string | null;
  onStopFollowing?: (() => void) | null;
  fs?: VirtualFS;
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { onRun, onFormat, fontSize = 14, interactionLockedLabel = null, onStopFollowing = null, fs },
  ref,
) {
  const { ydoc, awareness } = useCollab();
  const { theme } = useTheme();
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const activeFile = fs?.activeFile ?? null;
  const interactionLocked = Boolean(interactionLockedLabel);
  const editorOptions = useEditorOptions(fontSize, interactionLocked);

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
    disabled: interactionLocked,
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
    registerMonacoThemes(monaco);
    registerEditorFormatters(monaco);
  };

  useEffect(() => {
    if (!monacoEditor) return;
    monacoEditor.updateOptions({
      fontSize,
      readOnly: interactionLocked,
      domReadOnly: interactionLocked,
    });
  }, [fontSize, interactionLocked, monacoEditor]);

  useEffect(() => {
    if (!interactionLocked || !monacoEditor) {
      return;
    }

    const domNode = monacoEditor.getDomNode();
    if (!domNode) {
      return;
    }

    const activeElement = domNode.ownerDocument.activeElement;
    if (activeElement instanceof HTMLElement && domNode.contains(activeElement)) {
      activeElement.blur();
    }
  }, [interactionLocked, monacoEditor]);

  useEffect(() => {
    if (!monacoEditor || !monacoRef.current) {
      return;
    }

    monacoRef.current.editor.setTheme(theme.monacoTheme);
  }, [monacoEditor, theme.monacoTheme]);

  return (
    <div className={`cc-editor-shell h-full w-full ${interactionLocked ? 'cc-editor-locked' : ''}`}>
      <MonacoEditor
        defaultLanguage={primaryLanguage.monacoLanguage}
        theme={theme.monacoTheme}
        onMount={handleMount}
        options={editorOptions}
        loading={
          <div className="cc-text-muted flex h-full items-center justify-center text-sm">
            Loading editor...
          </div>
        }
      />
      {interactionLocked && (
        <div className="cc-editor-lock">
          <div className="cc-editor-lock-chip">
            <EyeIcon className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
            <span className="cc-text-primary truncate text-[11px] font-medium">
              {interactionLockedLabel}
            </span>
            <span className="cc-text-muted hidden text-[10px] sm:inline">Editing locked</span>
            {onStopFollowing && (
              <button
                type="button"
                onClick={onStopFollowing}
                title="Stop following"
                aria-label="Stop following"
                className="cc-icon-button cc-editor-lock-stop flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default Editor;

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import MonacoEditor, { type OnMount, type Monaco } from '@monaco-editor/react';
import * as Y from 'yjs';
import type { editor, ISelection } from 'monaco-editor';
import { useCollab } from '../context/CollabContext';
import { getMonacoLanguage, primaryLanguage, languages } from '../config/languages';
import type { DiagnosticMarker } from '../config/languages';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { MonacoBinding } from '../lib/MonacoBinding';

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

const MARKER_OWNER = 'collab-code-diagnostics';
const REMOTE_SELECTIONS_FIELD = 'selections';
const LEGACY_SELECTION_FIELD = 'selection';
const REMOTE_SELECTION_ACTIVITY_FIELD = 'selectionActivityAt';
const DEFAULT_REMOTE_COLOR = '#61afef';
const DEFAULT_REMOTE_NAME = 'Peer';
const REMOTE_LABEL_ANIMATION_MS = 2600;

type RelativeCursorSelection = {
  anchor: Y.RelativePosition;
  head: Y.RelativePosition;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRelativeCursorSelection(value: unknown): value is RelativeCursorSelection {
  if (!isRecord(value)) return false;
  return value.anchor != null && value.head != null;
}

function getRemoteSelections(state: unknown): RelativeCursorSelection[] {
  if (!isRecord(state)) return [];

  const multiSelections = state[REMOTE_SELECTIONS_FIELD];
  if (Array.isArray(multiSelections)) {
    return multiSelections.filter(isRelativeCursorSelection);
  }

  const singleSelection = state[LEGACY_SELECTION_FIELD];
  return isRelativeCursorSelection(singleSelection) ? [singleSelection] : [];
}

function getPeerMeta(state: unknown): { name: string; color: string } {
  if (!isRecord(state)) {
    return { name: DEFAULT_REMOTE_NAME, color: DEFAULT_REMOTE_COLOR };
  }

  const user = isRecord(state.user) ? state.user : null;
  const name = typeof user?.name === 'string' && user.name.trim()
    ? user.name.trim()
    : DEFAULT_REMOTE_NAME;
  const color = typeof user?.color === 'string' && user.color.trim()
    ? user.color.trim()
    : DEFAULT_REMOTE_COLOR;

  return { name, color };
}

function getSelectionActivityAt(state: unknown): number | null {
  if (!isRecord(state)) return null;
  const activityAt = state[REMOTE_SELECTION_ACTIVITY_FIELD];
  return typeof activityAt === 'number' && Number.isFinite(activityAt) ? activityAt : null;
}

function selectionKey(selection: ISelection): string {
  return [
    selection.selectionStartLineNumber,
    selection.selectionStartColumn,
    selection.positionLineNumber,
    selection.positionColumn,
  ].join(':');
}

function getOrderedSelections(ed: editor.IStandaloneCodeEditor): ISelection[] {
  const selections = ed.getSelections() ?? [];
  const primarySelection = ed.getSelection();

  if (!primarySelection || selections.length <= 1) return selections;

  const primaryKey = selectionKey(primarySelection);
  const primarySelections = selections.filter(selection => selectionKey(selection) === primaryKey);
  const secondarySelections = selections.filter(selection => selectionKey(selection) !== primaryKey);

  return [...primarySelections, ...secondarySelections];
}

function createRelativeSelection(
  selection: ISelection,
  model: editor.ITextModel,
  ytext: Y.Text,
): RelativeCursorSelection {
  const anchorOffset = model.getOffsetAt({
    lineNumber: selection.selectionStartLineNumber,
    column: selection.selectionStartColumn,
  });
  const headOffset = model.getOffsetAt({
    lineNumber: selection.positionLineNumber,
    column: selection.positionColumn,
  });
  const isCollapsed = anchorOffset === headOffset;
  const assoc = isCollapsed ? -1 : 0;

  return {
    // Empty carets are left-associated so inserts at the same index by other
    // peers don't make an idle remote cursor appear to type along.
    anchor: Y.createRelativePositionFromTypeIndex(ytext, anchorOffset, assoc),
    head: Y.createRelativePositionFromTypeIndex(ytext, headOffset, assoc),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.trim().replace(/^#/, '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return `rgba(97, 175, 239, ${alpha})`;
  }

  const int = Number.parseInt(expanded, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeCssContent(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ');
}

function buildRemotePeerStyles(states: Map<number, unknown>, localClientId: number, currentTime: number): string {
  const rules: string[] = [];

  states.forEach((state, clientId) => {
    if (clientId === localClientId) return;

    const { name, color } = getPeerMeta(state);
    const activityAt = getSelectionActivityAt(state);
    const elapsed = activityAt == null ? REMOTE_LABEL_ANIMATION_MS : Math.max(0, currentTime - activityAt);
    const animationDelay = -Math.min(elapsed, REMOTE_LABEL_ANIMATION_MS);
    const selectionFill = hexToRgba(color, 0.18);
    const selectionOutline = hexToRgba(color, 0.45);

    rules.push(`
.ccRemoteSelection-${clientId} {
  background-color: ${selectionFill};
  box-shadow: inset 0 0 0 1px ${selectionOutline};
}

.ccRemoteCursorHead-${clientId} {
  border-color: ${color};
}

.ccRemoteCursorHead-${clientId}::after {
  content: "${escapeCssContent(name)}";
  background-color: ${color};
  animation-delay: ${animationDelay}ms;
}
`);
  });

  return rules.join('\n');
}

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
  const remoteDecorationIdsRef = useRef<string[]>([]);
  const remoteStylesRef = useRef<HTMLStyleElement | null>(null);

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

  const getBindingTarget = useCallback(() => {
    const currentFs = fsRef.current;
    if (currentFs && activeFile) {
      const ytext = currentFs.getFileText(activeFile);
      if (ytext) {
        return { ytext, filePath: activeFile };
      }
    }

    return {
      ytext: ydoc.getText('code'),
      filePath: null as string | null,
    };
  }, [ydoc, activeFile]);

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
    revealLine: (line: number, col: number) => {
      if (!monacoEditor) return;
      monacoEditor.revealLineInCenter(line);
      monacoEditor.setPosition({ lineNumber: line, column: col });
      monacoEditor.focus();
    },
  }), [monacoEditor, activeFile, applyMarkersForFile]);

  // Re-apply markers when switching files
  useEffect(() => {
    if (allMarkersRef.current.length > 0) {
      applyMarkersForFile(activeFile);
    }
  }, [activeFile, applyMarkersForFile]);

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.dataset.collabCode = 'remote-peer-selections';
    document.head.appendChild(styleElement);
    remoteStylesRef.current = styleElement;

    return () => {
      styleElement.remove();
      remoteStylesRef.current = null;
    };
  }, []);

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
      run: async (editorInstance) => {
        await editorInstance.getAction('editor.action.formatDocument')?.run();
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

  useEffect(() => {
    if (!awareness) return;

    return () => {
      awareness.setLocalStateField(REMOTE_SELECTIONS_FIELD, []);
      awareness.setLocalStateField(LEGACY_SELECTION_FIELD, null);
      awareness.setLocalStateField(REMOTE_SELECTION_ACTIVITY_FIELD, null);
    };
  }, [awareness]);

  // Bind to the active file's Y.Text (or fall back to legacy Y.Text('code'))
  useEffect(() => {
    if (!monacoEditor) return;

    const { ytext, filePath } = getBindingTarget();

    // Do not re-bind if we're already bound to this file.
    if (boundFileRef.current === filePath && bindingRef.current) return;

    // Clean up previous binding.
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    // Set language based on file extension.
    const model = monacoEditor.getModel();
    if (model && filePath) {
      monacoRef.current?.editor.setModelLanguage(model, getMonacoLanguage(filePath));
    }

    // Create new binding without awareness. Remote cursors are rendered separately
    // so we can support Monaco's multi-cursor selections per peer.
    const binding = new MonacoBinding(
      ytext,
      monacoEditor.getModel()!,
      new Set([monacoEditor]),
    );
    bindingRef.current = binding;
    boundFileRef.current = filePath;

    return () => {
      binding.destroy();
      bindingRef.current = null;
      boundFileRef.current = null;
    };
  }, [monacoEditor, getBindingTarget]);

  useEffect(() => {
    if (!monacoEditor || !awareness) return;

    const model = monacoEditor.getModel();
    if (!model) return;

    const publishLocalSelections = () => {
      const { ytext } = getBindingTarget();
      const activityAt = Date.now();
      const relativeSelections = getOrderedSelections(monacoEditor)
        .map(selection => createRelativeSelection(selection, model, ytext));

      awareness.setLocalStateField(REMOTE_SELECTIONS_FIELD, relativeSelections);
      awareness.setLocalStateField(LEGACY_SELECTION_FIELD, relativeSelections[0] ?? null);
      awareness.setLocalStateField(REMOTE_SELECTION_ACTIVITY_FIELD, activityAt);
    };

    publishLocalSelections();
    const disposable = monacoEditor.onDidChangeCursorSelection(publishLocalSelections);

    return () => {
      disposable.dispose();
    };
  }, [monacoEditor, awareness, getBindingTarget]);

  useEffect(() => {
    if (!monacoEditor || !awareness) return;

    const monaco = monacoRef.current;
    const model = monacoEditor.getModel();
    if (!monaco || !model) return;

    const { ytext } = getBindingTarget();

    const renderRemoteSelections = () => {
      const now = Date.now();
      if (remoteStylesRef.current) {
        remoteStylesRef.current.textContent = buildRemotePeerStyles(awareness.getStates(), ydoc.clientID, now);
      }

      const decorations: editor.IModelDeltaDecoration[] = [];

      awareness.getStates().forEach((state, clientId) => {
        if (clientId === ydoc.clientID) return;

        const peerSelections = getRemoteSelections(state);
        if (peerSelections.length === 0) return;

        peerSelections.forEach((selection, index) => {
          const anchorAbs = Y.createAbsolutePositionFromRelativePosition(selection.anchor, ydoc);
          const headAbs = Y.createAbsolutePositionFromRelativePosition(selection.head, ydoc);

          if (!anchorAbs || !headAbs || anchorAbs.type !== ytext || headAbs.type !== ytext) {
            return;
          }

          const startIndex = Math.min(anchorAbs.index, headAbs.index);
          const endIndex = Math.max(anchorAbs.index, headAbs.index);
          const start = model.getPositionAt(startIndex);
          const end = model.getPositionAt(endIndex);
          const isHeadAfterAnchor = headAbs.index >= anchorAbs.index;
          const cursorClassName = [
            'ccRemoteCursorHead',
            `ccRemoteCursorHead-${clientId}`,
            index === 0 ? 'ccRemoteCursorHeadLabeled' : 'ccRemoteCursorHeadSecondary',
          ].join(' ');

          decorations.push({
            range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
            options: {
              className: startIndex === endIndex ? undefined : `ccRemoteSelection ccRemoteSelection-${clientId}`,
              afterContentClassName: isHeadAfterAnchor ? cursorClassName : undefined,
              beforeContentClassName: isHeadAfterAnchor ? undefined : cursorClassName,
            },
          });
        });
      });

      remoteDecorationIdsRef.current = monacoEditor.deltaDecorations(remoteDecorationIdsRef.current, decorations);
    };

    const handleAwarenessChange = () => {
      renderRemoteSelections();
    };
    const handleTextChange = () => {
      renderRemoteSelections();
    };

    renderRemoteSelections();
    awareness.on('change', handleAwarenessChange);
    ytext.observe(handleTextChange);

    return () => {
      awareness.off('change', handleAwarenessChange);
      ytext.unobserve(handleTextChange);
      if (remoteStylesRef.current) {
        remoteStylesRef.current.textContent = '';
      }
      remoteDecorationIdsRef.current = monacoEditor.deltaDecorations(remoteDecorationIdsRef.current, []);
    };
  }, [monacoEditor, awareness, ydoc, getBindingTarget]);

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

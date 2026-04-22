import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { Awareness } from 'y-protocols/awareness';
import type { editor } from 'monaco-editor';
import * as Y from 'yjs';
import {
  LEGACY_SELECTION_FIELD,
  REMOTE_SELECTION_ACTIVITY_FIELD,
  REMOTE_SELECTIONS_FIELD,
  buildRemotePeerStyles,
  createRelativeSelection,
  getOrderedSelections,
  getRemoteSelections,
} from '../services/editorSelections';
import type { EditorBindingTarget } from './useEditorBinding';

interface UseRemoteMonacoSelectionsOptions {
  monacoEditor: editor.IStandaloneCodeEditor | null;
  monacoRef: MutableRefObject<Monaco | null>;
  awareness: Awareness | null;
  ydoc: Y.Doc;
  getBindingTarget: () => EditorBindingTarget;
  disabled?: boolean;
}

function clearLocalSelections(awareness: Awareness): void {
  awareness.setLocalStateField(REMOTE_SELECTIONS_FIELD, []);
  awareness.setLocalStateField(LEGACY_SELECTION_FIELD, null);
  awareness.setLocalStateField(REMOTE_SELECTION_ACTIVITY_FIELD, null);
}

export function useRemoteMonacoSelections({
  monacoEditor,
  monacoRef,
  awareness,
  ydoc,
  getBindingTarget,
  disabled = false,
}: UseRemoteMonacoSelectionsOptions) {
  const remoteDecorationIdsRef = useRef<string[]>([]);
  const remoteStylesRef = useRef<HTMLStyleElement | null>(null);

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

  useEffect(() => {
    if (!awareness) return;

    if (disabled) {
      clearLocalSelections(awareness);
      return;
    }

    return () => {
      clearLocalSelections(awareness);
    };
  }, [awareness, disabled]);

  useEffect(() => {
    if (!monacoEditor || !awareness || disabled) return;

    const model = monacoEditor.getModel();
    if (!model) return;

    const publishLocalSelections = () => {
      const { ytext } = getBindingTarget();
      const activityAt = Date.now();
      const relativeSelections = getOrderedSelections(monacoEditor).map((selection) =>
        createRelativeSelection(selection, model, ytext),
      );

      awareness.setLocalStateField(REMOTE_SELECTIONS_FIELD, relativeSelections);
      awareness.setLocalStateField(LEGACY_SELECTION_FIELD, relativeSelections[0] ?? null);
      awareness.setLocalStateField(REMOTE_SELECTION_ACTIVITY_FIELD, activityAt);
    };

    publishLocalSelections();
    const disposable = monacoEditor.onDidChangeCursorSelection(publishLocalSelections);

    return () => {
      disposable.dispose();
    };
  }, [awareness, disabled, getBindingTarget, monacoEditor]);

  useEffect(() => {
    if (!monacoEditor || !awareness) return;

    const monaco = monacoRef.current;
    const model = monacoEditor.getModel();
    if (!monaco || !model) return;

    const { ytext } = getBindingTarget();

    const renderRemoteSelections = () => {
      const currentTime = Date.now();
      if (remoteStylesRef.current) {
        remoteStylesRef.current.textContent = buildRemotePeerStyles(
          awareness.getStates(),
          ydoc.clientID,
          currentTime,
        );
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
              className:
                startIndex === endIndex
                  ? undefined
                  : `ccRemoteSelection ccRemoteSelection-${clientId}`,
              afterContentClassName: isHeadAfterAnchor ? cursorClassName : undefined,
              beforeContentClassName: isHeadAfterAnchor ? undefined : cursorClassName,
            },
          });
        });
      });

      remoteDecorationIdsRef.current = monacoEditor.deltaDecorations(
        remoteDecorationIdsRef.current,
        decorations,
      );
    };

    renderRemoteSelections();
    awareness.on('change', renderRemoteSelections);
    ytext.observe(renderRemoteSelections);

    return () => {
      awareness.off('change', renderRemoteSelections);
      ytext.unobserve(renderRemoteSelections);
      if (remoteStylesRef.current) {
        remoteStylesRef.current.textContent = '';
      }
      remoteDecorationIdsRef.current = monacoEditor.deltaDecorations(
        remoteDecorationIdsRef.current,
        [],
      );
    };
  }, [awareness, getBindingTarget, monacoEditor, monacoRef, ydoc]);
}

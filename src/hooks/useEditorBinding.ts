import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import * as Y from 'yjs';
import { getMonacoLanguage } from '../config/languages';
import type { VirtualFS } from './useVirtualFS';
import { MonacoBinding } from '../lib/MonacoBinding';

export interface EditorBindingTarget {
  ytext: Y.Text;
  filePath: string | null;
}

interface UseEditorBindingOptions {
  monacoEditor: editor.IStandaloneCodeEditor | null;
  monacoRef: MutableRefObject<Monaco | null>;
  ydoc: Y.Doc;
  fs?: VirtualFS;
  activeFile: string | null;
}

export function useEditorBinding({
  monacoEditor,
  monacoRef,
  ydoc,
  fs,
  activeFile,
}: UseEditorBindingOptions) {
  const bindingRef = useRef<MonacoBinding | null>(null);
  const boundFileRef = useRef<string | null>(null);
  const fsRef = useRef(fs);

  useEffect(() => {
    fsRef.current = fs;
  }, [fs]);

  const getBindingTarget = useCallback((): EditorBindingTarget => {
    const currentFs = fsRef.current;
    if (currentFs && activeFile) {
      const ytext = currentFs.getFileText(activeFile);
      if (ytext) {
        return { ytext, filePath: activeFile };
      }
    }

    return {
      ytext: ydoc.getText('code'),
      filePath: null,
    };
  }, [activeFile, ydoc]);

  useEffect(() => {
    if (!monacoEditor) return;

    const model = monacoEditor.getModel();
    if (!model) return;

    const { ytext, filePath } = getBindingTarget();

    if (boundFileRef.current === filePath && bindingRef.current) {
      return;
    }

    bindingRef.current?.destroy();
    bindingRef.current = null;

    if (filePath) {
      monacoRef.current?.editor.setModelLanguage(model, getMonacoLanguage(filePath));
    }

    const binding = new MonacoBinding(ytext, model, new Set([monacoEditor]));
    bindingRef.current = binding;
    boundFileRef.current = filePath;

    return () => {
      binding.destroy();
      if (bindingRef.current === binding) {
        bindingRef.current = null;
      }
      if (boundFileRef.current === filePath) {
        boundFileRef.current = null;
      }
    };
  }, [getBindingTarget, monacoEditor, monacoRef]);

  return { getBindingTarget };
}

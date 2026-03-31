import { useEffect, useMemo, useState } from 'react';
import type { editor } from 'monaco-editor';

function getViewportWidth(): number {
  return typeof window === 'undefined' ? 1024 : window.innerWidth;
}

function buildEditorOptions(
  fontSize: number,
  viewportWidth: number,
): editor.IStandaloneEditorConstructionOptions {
  return {
    fontSize,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 28 },
    wordWrap: 'on',
    tabSize: 4,
    insertSpaces: true,
    lineNumbers: viewportWidth < 480 ? 'off' : 'on',
    folding: viewportWidth >= 640,
    glyphMargin: false,
    lineDecorationsWidth: viewportWidth < 640 ? 4 : 10,
    dragAndDrop: false,
    dropIntoEditor: { enabled: false },
  };
}

export function useEditorOptions(fontSize: number): editor.IStandaloneEditorConstructionOptions {
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(getViewportWidth());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return useMemo(() => buildEditorOptions(fontSize, viewportWidth), [fontSize, viewportWidth]);
}

import type { Monaco } from '@monaco-editor/react';

let registeredMonacoThemes = false;

export function registerMonacoThemes(monaco: Monaco): void {
  if (registeredMonacoThemes) {
    return;
  }

  monaco.editor.defineTheme('collab-code-dark', {
    base: 'vs-dark',
    inherit: true,
    colors: {
      'editor.background': '#0d1520',
      'editor.foreground': '#e8eef6',
      'editor.lineHighlightBackground': '#142030',
      'editor.selectionBackground': '#21405a',
      'editor.inactiveSelectionBackground': '#1a3146',
      'editorLineNumber.foreground': '#71829b',
      'editorLineNumber.activeForeground': '#cbd5e1',
      'editorCursor.foreground': '#34d399',
      'editorWhitespace.foreground': '#314154',
      'editorIndentGuide.background1': '#233244',
      'editorIndentGuide.activeBackground1': '#41516a',
      'editorWidget.background': '#1a2637',
      'editorWidget.border': '#304055',
      'editorSuggestWidget.background': '#1a2637',
      'editorSuggestWidget.border': '#304055',
      'editorHoverWidget.background': '#1a2637',
      'editorHoverWidget.border': '#304055',
      'editorGutter.background': '#0d1520',
    },
    rules: [],
  });

  monaco.editor.defineTheme('collab-code-light', {
    base: 'vs',
    inherit: true,
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#162334',
      'editor.lineHighlightBackground': '#eef4fb',
      'editor.selectionBackground': '#cfe5ff',
      'editor.inactiveSelectionBackground': '#e2edf8',
      'editorLineNumber.foreground': '#58697f',
      'editorLineNumber.activeForeground': '#2d4056',
      'editorCursor.foreground': '#047857',
      'editorWhitespace.foreground': '#d7e2ee',
      'editorIndentGuide.background1': '#dce5f0',
      'editorIndentGuide.activeBackground1': '#afc0d4',
      'editorWidget.background': '#ffffff',
      'editorWidget.border': '#cad7e5',
      'editorSuggestWidget.background': '#ffffff',
      'editorSuggestWidget.border': '#cad7e5',
      'editorHoverWidget.background': '#ffffff',
      'editorHoverWidget.border': '#cad7e5',
      'editorGutter.background': '#ffffff',
    },
    rules: [],
  });

  registeredMonacoThemes = true;
}

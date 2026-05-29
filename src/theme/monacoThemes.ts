import type { Monaco } from '@monaco-editor/react';
import { themeDefinitions, type AppThemeDefinition } from './themes';

let registeredMonacoThemes = false;

// Editor-chrome colors that have no equivalent in the shared CSS palette
// (text selections, line numbers, whitespace dots, indent guides). Everything
// else is read from the theme's `cssVars` in buildEditorColors() below, so the
// editor can't drift from the rest of the app's palette.
interface EditorOnlyColors {
  lineHighlightBackground: string;
  selectionBackground: string;
  inactiveSelectionBackground: string;
  lineNumberForeground: string;
  lineNumberActiveForeground: string;
  whitespaceForeground: string;
  indentGuideBackground: string;
}

const editorOnlyColorsByTheme: Record<string, EditorOnlyColors> = {
  'cc-dark': {
    lineHighlightBackground: '#142030',
    selectionBackground: '#21405a',
    inactiveSelectionBackground: '#1a3146',
    lineNumberForeground: '#71829b',
    lineNumberActiveForeground: '#cbd5e1',
    whitespaceForeground: '#314154',
    indentGuideBackground: '#233244',
  },
  'cc-light': {
    lineHighlightBackground: '#eef4fb',
    selectionBackground: '#cfe5ff',
    inactiveSelectionBackground: '#e2edf8',
    lineNumberForeground: '#58697f',
    lineNumberActiveForeground: '#2d4056',
    whitespaceForeground: '#d7e2ee',
    indentGuideBackground: '#dce5f0',
  },
};

function buildEditorColors(theme: AppThemeDefinition): Record<string, string> {
  const palette = theme.cssVars;
  const editorOnly = editorOnlyColorsByTheme[theme.id];

  return {
    'editor.background': palette['--cc-bg-editor'],
    'editor.foreground': palette['--cc-text-primary'],
    'editor.lineHighlightBackground': editorOnly.lineHighlightBackground,
    'editor.selectionBackground': editorOnly.selectionBackground,
    'editor.inactiveSelectionBackground': editorOnly.inactiveSelectionBackground,
    'editorLineNumber.foreground': editorOnly.lineNumberForeground,
    'editorLineNumber.activeForeground': editorOnly.lineNumberActiveForeground,
    'editorCursor.foreground': palette['--cc-accent'],
    'editorWhitespace.foreground': editorOnly.whitespaceForeground,
    'editorIndentGuide.background1': editorOnly.indentGuideBackground,
    'editorIndentGuide.activeBackground1': palette['--cc-border-strong'],
    'editorWidget.background': palette['--cc-bg-elevated'],
    'editorWidget.border': palette['--cc-border'],
    'editorSuggestWidget.background': palette['--cc-bg-elevated'],
    'editorSuggestWidget.border': palette['--cc-border'],
    'editorHoverWidget.background': palette['--cc-bg-elevated'],
    'editorHoverWidget.border': palette['--cc-border'],
    'editorGutter.background': palette['--cc-bg-editor'],
  };
}

export function registerMonacoThemes(monaco: Monaco): void {
  if (registeredMonacoThemes) {
    return;
  }

  for (const theme of themeDefinitions) {
    if (!editorOnlyColorsByTheme[theme.id]) {
      continue;
    }

    monaco.editor.defineTheme(theme.monacoTheme, {
      base: theme.colorScheme === 'dark' ? 'vs-dark' : 'vs',
      inherit: true,
      colors: buildEditorColors(theme),
      rules: [],
    });
  }

  registeredMonacoThemes = true;
}

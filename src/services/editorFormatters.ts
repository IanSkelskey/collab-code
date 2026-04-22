import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { languages } from '../config/languages';

function formatBraceCode(text: string, tabSize: number): string {
  const lines = text.split('\n');
  const formattedLines: string[] = [];
  let indent = 0;

  for (const rawLine of lines) {
    const strippedLine = rawLine.trim();

    if (!strippedLine) {
      formattedLines.push('');
      continue;
    }

    let leadingClosingBraces = 0;
    for (const character of strippedLine) {
      if (character === '}') {
        leadingClosingBraces += 1;
      } else {
        break;
      }
    }

    const lineIndent = Math.max(0, indent - leadingClosingBraces);
    formattedLines.push(`${' '.repeat(lineIndent * tabSize)}${strippedLine}`);

    const openingBraces = (strippedLine.match(/{/g) || []).length;
    const closingBraces = (strippedLine.match(/}/g) || []).length;
    indent = Math.max(0, indent + openingBraces - closingBraces);
  }

  return formattedLines.join('\n');
}

const registeredFormatters = new Set<string>();

function registerBraceFormatter(monaco: Monaco, languageId: string) {
  monaco.languages.registerDocumentFormattingEditProvider(languageId, {
    provideDocumentFormattingEdits(model: editor.ITextModel) {
      const formatted = formatBraceCode(model.getValue(), model.getOptions().tabSize);
      return [{ range: model.getFullModelRange(), text: formatted }];
    },
  });
}

function registerPythonFormatter(monaco: Monaco) {
  monaco.languages.registerDocumentFormattingEditProvider('python', {
    provideDocumentFormattingEdits(model: editor.ITextModel) {
      const formatted = model
        .getValue()
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n');

      return [{ range: model.getFullModelRange(), text: formatted }];
    },
  });
}

export function registerEditorFormatters(monaco: Monaco): void {
  for (const language of languages) {
    if (!language.braceFormatted || registeredFormatters.has(language.monacoLanguage)) {
      continue;
    }

    registerBraceFormatter(monaco, language.monacoLanguage);
    registeredFormatters.add(language.monacoLanguage);
  }

  if (!registeredFormatters.has('python')) {
    registerPythonFormatter(monaco);
    registeredFormatters.add('python');
  }
}

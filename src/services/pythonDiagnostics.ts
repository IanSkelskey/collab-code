import { MarkerSeverity, type DiagnosticMarker } from './javaDiagnostics';

/**
 * Parse Python stderr output into Monaco-compatible diagnostic markers.
 *
 * Handles both runtime tracebacks and syntax errors.
 */
export function parsePythonRuntimeErrors(stderr: string): DiagnosticMarker[] {
  if (!stderr) {
    return [];
  }

  const lines = stderr.split(/\r?\n/);
  const markers: DiagnosticMarker[] = [];
  const filePattern = /File "(?:.*[/\\])?([^"\\]+\.py)", line (\d+)/;
  let messageLine: string | null = null;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (line && !line.startsWith('Traceback')) {
      messageLine = line;
      break;
    }
  }

  if (!messageLine) {
    return [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(filePattern);
    if (!match) {
      continue;
    }

    const fileName = match[1];
    const lineNumber = Number.parseInt(match[2], 10);
    if (Number.isNaN(lineNumber)) {
      continue;
    }

    let startColumn = 1;
    let endColumn = 1000;

    const caretLine = lines[index + 2] ?? '';
    const caretIndex = caretLine.indexOf('^');
    if (caretIndex >= 0) {
      startColumn = caretIndex + 1;
      endColumn = caretLine.lastIndexOf('^') + 2;
    }

    markers.push({
      severity: MarkerSeverity.Error,
      startLineNumber: lineNumber,
      startColumn,
      endLineNumber: lineNumber,
      endColumn,
      message: messageLine,
      source: 'python-runtime',
      file: fileName,
    });
  }

  return markers;
}

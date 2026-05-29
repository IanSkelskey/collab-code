/**
 * Parse javac compiler output into Monaco-compatible diagnostic markers.
 *
 * Typical javac output:
 *   Main.java:3: error: ';' expected
 *           System.out.println("Hello")
 *                                      ^
 *   Main.java:5: warning: [unchecked] unchecked call to add(E)
 *           list.add("hello");
 *                ^
 *   2 errors
 */

/** Severity levels matching Monaco's MarkerSeverity enum values */
export const MarkerSeverity = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
} as const;

export interface DiagnosticMarker {
  severity: number;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  source: string;
  /** The source filename (e.g. "Main.java") extracted from compiler output */
  file?: string;
}

/**
 * Parse javac compile output into an array of diagnostic markers.
 */
export function parseJavaDiagnostics(compileOutput: string): DiagnosticMarker[] {
  if (!compileOutput) return [];

  const markers: DiagnosticMarker[] = [];
  // Split on CRLF or LF: a Windows exec server emits `\r\n`, and a trailing
  // `\r` left on each line breaks the `$`-anchored diagnostic regex below.
  const lines = compileOutput.split(/\r?\n/);

  // Match lines like:  Main.java:3: error: ';' expected
  // or:                /tmp/collab-exec-xxx/Main.java:3: error: ...
  // or:                Main.java:3: warning: [unchecked] unchecked call
  const diagnosticPattern = /^(?:.*[/\\])?(\w+\.java):(\d+):\s*(error|warning):\s*(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(diagnosticPattern);
    if (!match) continue;

    const fileName = match[1];
    const lineNumber = parseInt(match[2], 10);
    const severityStr = match[3];
    const message = match[4].trim();

    const severity = severityStr === 'error' ? MarkerSeverity.Error : MarkerSeverity.Warning;

    // Default: underline the whole line.
    let column = 1;
    let endColumn = 1000;

    // javac echoes the offending source line, then a caret (^) line pointing at
    // a column. A 1-char marker at the caret is often invisible (e.g. an
    // end-of-line "';' expected"), so underline the echoed line's whole code
    // span (first non-space → end) to give a clearly visible squiggle.
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const caretIndex = lines[j].indexOf('^');
      if (caretIndex < 0) continue;

      const sourceLine = j - 1 > i ? (lines[j - 1] ?? '') : '';
      const firstNonSpace = sourceLine.search(/\S/);

      if (firstNonSpace >= 0) {
        column = firstNonSpace + 1; // Monaco columns are 1-based
        endColumn = sourceLine.length + 1;
      } else {
        column = caretIndex + 1;
        endColumn = lines[j].lastIndexOf('^') + 2;
      }
      break;
    }

    markers.push({
      severity,
      startLineNumber: lineNumber,
      startColumn: column,
      endLineNumber: lineNumber,
      endColumn,
      message,
      source: 'javac',
      file: fileName,
    });
  }

  return markers;
}

/**
 * Parse runtime errors (e.g. exceptions with stack traces) into markers.
 * Java runtime errors look like:
 *   Exception in thread "main" java.lang.NullPointerException
 *       at Main.main(Main.java:5)
 */
export function parseJavaRuntimeErrors(stderr: string): DiagnosticMarker[] {
  if (!stderr) return [];

  const markers: DiagnosticMarker[] = [];
  const lines = stderr.split(/\r?\n/);

  // Find the main exception message
  let exceptionMessage = '';
  for (const line of lines) {
    const exMatch = line.match(
      /(?:Exception in thread ".+?" |^)([\w$.]+(?:Exception|Error))(?::\s*(.+))?$/,
    );
    if (exMatch) {
      exceptionMessage = exMatch[2] ? `${exMatch[1]}: ${exMatch[2]}` : exMatch[1];
      break;
    }
  }

  if (!exceptionMessage) return [];

  // Find lines referencing any .java file in the stack trace
  const stackPattern = /at\s+\S+\((\w+\.java):(\d+)\)/;
  for (const line of lines) {
    const match = line.match(stackPattern);
    if (match) {
      const fileName = match[1];
      const lineNumber = parseInt(match[2], 10);
      markers.push({
        severity: MarkerSeverity.Error,
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: 1000,
        message: exceptionMessage,
        source: 'java-runtime',
        file: fileName,
      });
    }
  }

  return markers;
}

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
  const lines = compileOutput.split('\n');

  // Match lines like:  Main.java:3: error: ';' expected
  // or:                /tmp/collab-exec-xxx/Main.java:3: error: ...
  // or:                Main.java:3: warning: [unchecked] unchecked call
  const diagnosticPattern = /^(?:.*[\/\\])?(\w+\.java):(\d+):\s*(error|warning):\s*(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(diagnosticPattern);
    if (!match) continue;

    const fileName = match[1];
    const lineNumber = parseInt(match[2], 10);
    const severityStr = match[3];
    const message = match[4].trim();

    const severity =
      severityStr === 'error' ? MarkerSeverity.Error : MarkerSeverity.Warning;

    // Try to find the caret (^) indicator on a subsequent line for column info
    let column = 1;
    let endColumn = 1000; // Default: underline the whole line

    // Look ahead up to 3 lines for the caret
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const caretIndex = lines[j].indexOf('^');
      if (caretIndex >= 0) {
        column = caretIndex + 1; // Monaco columns are 1-based
        // Try to find the extent — some javac output has multiple carets
        const lastCaret = lines[j].lastIndexOf('^');
        endColumn = lastCaret + 2;
        break;
      }
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
  const lines = stderr.split('\n');

  // Find the main exception message
  let exceptionMessage = '';
  for (const line of lines) {
    const exMatch = line.match(
      /(?:Exception in thread ".+?" |^)([\w$.]+(?:Exception|Error))(?::\s*(.+))?$/
    );
    if (exMatch) {
      exceptionMessage = exMatch[2]
        ? `${exMatch[1]}: ${exMatch[2]}`
        : exMatch[1];
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

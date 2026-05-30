import {
  parseJavaDiagnostics,
  parseJavaRuntimeErrors,
  type DiagnosticMarker,
} from '../services/javaDiagnostics';
import { stripVfsRoot } from '../lib/vfsPaths';
import { parsePythonRuntimeErrors } from '../services/pythonDiagnostics';

export interface LanguageConfig {
  /** Unique language identifier */
  id: string;
  /** Display name (e.g. "Java", "Python") */
  label: string;
  /** File extensions including the dot (e.g. ['.java']) */
  extensions: string[];
  /** Monaco editor language ID */
  monacoLanguage: string;
  /** Tailwind CSS color class for file icons (e.g. 'text-orange-400') */
  iconColor: string;
  /** Optional icon mapping key (resolved to an icon component elsewhere) */
  iconName?: string;
  /** MIME type for file downloads */
  mimeType: string;
  /** Whether this language can be offered as an execution target */
  runnable: boolean;
  /** Default file to create for starter workspaces */
  defaultFile?: { name: string; content: string };
  /** Regex to detect entry points in file content (e.g. Java main method) */
  entryPointPattern?: RegExp;
  /** Extract the runnable name from a file path (e.g. "Main" from "~/Main.java") */
  extractEntryPointName?: (filePath: string) => string;
  /** Parse compiler output into Monaco diagnostic markers */
  parseDiagnostics?: (output: string) => DiagnosticMarker[];
  /** Parse runtime error output into Monaco diagnostic markers */
  parseRuntimeErrors?: (stderr: string) => DiagnosticMarker[];
  /** Whether this language should use the brace-based code formatter */
  braceFormatted?: boolean;
}

export type { DiagnosticMarker };

const languages: LanguageConfig[] = [
  {
    id: 'java',
    label: 'Java',
    extensions: ['.java'],
    monacoLanguage: 'java',
    iconColor: 'text-orange-400',
    iconName: 'java',
    mimeType: 'text/x-java',
    runnable: true,
    defaultFile: {
      name: 'Main.java',
      content: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Collab Code!");\n    }\n}\n`,
    },
    entryPointPattern: /public\s+static\s+void\s+main\s*\(\s*String/,
    extractEntryPointName: (filePath: string) =>
      filePath
        .split('/')
        .pop()!
        .replace(/\.java$/, ''),
    parseDiagnostics: parseJavaDiagnostics,
    parseRuntimeErrors: parseJavaRuntimeErrors,
    braceFormatted: true,
  },
  {
    id: 'python',
    label: 'Python',
    extensions: ['.py'],
    monacoLanguage: 'python',
    iconColor: 'text-blue-400',
    iconName: 'python',
    mimeType: 'text/x-python',
    runnable: true,
    defaultFile: {
      name: 'main.py',
      content: `from rich.console import Console
from rich.table import Table


def main():
    console = Console()
    table = Table(title="Collab Code Python Starter")
    table.add_column("File")
    table.add_column("Purpose")
    table.add_row("main.py", "Runs the starter script")
    table.add_row("requirements.txt", "Lists packages to install before each run")

    console.print(table)
    console.print("\\nUpdate requirements.txt to add more packages for this room.")


if __name__ == "__main__":
    main()
`,
    },
    entryPointPattern: /\S/,
    extractEntryPointName: (filePath: string) => stripVfsRoot(filePath),
    parseRuntimeErrors: parsePythonRuntimeErrors,
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    extensions: ['.js', '.mjs'],
    monacoLanguage: 'javascript',
    iconColor: 'text-yellow-400',
    iconName: 'js',
    mimeType: 'text/javascript',
    runnable: false,
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    monacoLanguage: 'typescript',
    iconColor: 'text-blue-400',
    iconName: 'ts',
    mimeType: 'text/typescript',
    runnable: false,
  },
  {
    id: 'json',
    label: 'JSON',
    extensions: ['.json'],
    monacoLanguage: 'json',
    iconColor: 'text-amber-300',
    iconName: 'json',
    mimeType: 'application/json',
    runnable: false,
  },
  {
    id: 'xml',
    label: 'XML',
    extensions: ['.xml'],
    monacoLanguage: 'xml',
    iconColor: 'cc-text-muted',
    mimeType: 'application/xml',
    runnable: false,
  },
  {
    id: 'html',
    label: 'HTML',
    extensions: ['.html'],
    monacoLanguage: 'html',
    iconColor: 'text-red-400',
    iconName: 'html',
    mimeType: 'text/html',
    runnable: false,
  },
  {
    id: 'css',
    label: 'CSS',
    extensions: ['.css'],
    monacoLanguage: 'css',
    iconColor: 'text-purple-400',
    iconName: 'css',
    mimeType: 'text/css',
    runnable: false,
  },
  {
    id: 'markdown',
    label: 'Markdown',
    extensions: ['.md'],
    monacoLanguage: 'markdown',
    iconColor: 'cc-text-secondary',
    iconName: 'markdown',
    mimeType: 'text/markdown',
    runnable: false,
  },
  {
    id: 'c',
    label: 'C',
    extensions: ['.c', '.h'],
    monacoLanguage: 'c',
    iconColor: 'cc-text-muted',
    iconName: 'c',
    mimeType: 'text/x-csrc',
    runnable: false,
    braceFormatted: true,
  },
  {
    id: 'cpp',
    label: 'C++',
    extensions: ['.cpp', '.hpp'],
    monacoLanguage: 'cpp',
    iconColor: 'cc-text-muted',
    iconName: 'cpp',
    mimeType: 'text/x-c++src',
    runnable: false,
    braceFormatted: true,
  },
  {
    id: `sql`,
    label: 'SQL',
    extensions: ['.sql'],
    monacoLanguage: 'sql',
    iconColor: 'text-green-400',
    iconName: 'sql',
    mimeType: 'text/x-sql',
    runnable: false,
  },
  {
    id: 'perl',
    label: 'Perl',
    extensions: ['.pl', '.pm'],
    monacoLanguage: 'perl',
    iconColor: 'text-purple-400',
    iconName: 'perl',
    mimeType: 'text/x-perl',
    runnable: false,
  },
];

// Build lookup map for O(1) extension-based access
const extToConfig = new Map<string, LanguageConfig>();
const idToConfig = new Map<string, LanguageConfig>();
for (const lang of languages) {
  idToConfig.set(lang.id, lang);
  for (const ext of lang.extensions) {
    extToConfig.set(ext, lang);
  }
}

/** Get the LanguageConfig for a language identifier */
export function getLanguageConfig(id: string): LanguageConfig | undefined {
  return idToConfig.get(id);
}

/** Get the LanguageConfig for a file path based on its extension */
export function getLanguageForFile(path: string): LanguageConfig | undefined {
  const dotIndex = path.lastIndexOf('.');
  if (dotIndex < 0) return undefined;
  return extToConfig.get(path.slice(dotIndex));
}

/** Whether a file path should use the markdown preview flow */
export function isMarkdownFile(path: string | null | undefined): boolean {
  return typeof path === 'string' && getLanguageForFile(path)?.id === 'markdown';
}

/** Get the Monaco language ID for a file path (defaults to 'plaintext') */
export function getMonacoLanguage(path: string): string {
  return getLanguageForFile(path)?.monacoLanguage ?? 'plaintext';
}

/** Get the Tailwind icon color class for a file path */
export function getIconColor(path: string): string {
  return getLanguageForFile(path)?.iconColor ?? 'cc-text-muted';
}

/** Get the MIME type for a file path */
export function getMimeType(path: string): string {
  return getLanguageForFile(path)?.mimeType ?? 'text/plain';
}

/** The primary language - used for defaults, terminal branding, etc. */
export const primaryLanguage: LanguageConfig = languages[0];

export { languages };

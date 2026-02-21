import { parseJavaDiagnostics, parseJavaRuntimeErrors, type DiagnosticMarker } from '../services/javaDiagnostics';

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
  /** MIME type for file downloads */
  mimeType: string;
  /** Default file to create for new workspaces (only for primary/runnable languages) */
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
    mimeType: 'text/x-java',
    defaultFile: {
      name: 'Main.java',
      content: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Collab Code!");\n    }\n}\n`,
    },
    entryPointPattern: /public\s+static\s+void\s+main\s*\(\s*String/,
    extractEntryPointName: (filePath: string) =>
      filePath.split('/').pop()!.replace(/\.java$/, ''),
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
    mimeType: 'text/x-python',
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    extensions: ['.js', '.mjs'],
    monacoLanguage: 'javascript',
    iconColor: 'text-yellow-400',
    mimeType: 'text/javascript',
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    monacoLanguage: 'typescript',
    iconColor: 'text-blue-400',
    mimeType: 'text/typescript',
  },
  {
    id: 'json',
    label: 'JSON',
    extensions: ['.json'],
    monacoLanguage: 'json',
    iconColor: 'text-amber-300',
    mimeType: 'application/json',
  },
  {
    id: 'xml',
    label: 'XML',
    extensions: ['.xml'],
    monacoLanguage: 'xml',
    iconColor: 'text-zinc-400',
    mimeType: 'application/xml',
  },
  {
    id: 'html',
    label: 'HTML',
    extensions: ['.html'],
    monacoLanguage: 'html',
    iconColor: 'text-red-400',
    mimeType: 'text/html',
  },
  {
    id: 'css',
    label: 'CSS',
    extensions: ['.css'],
    monacoLanguage: 'css',
    iconColor: 'text-purple-400',
    mimeType: 'text/css',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    extensions: ['.md'],
    monacoLanguage: 'markdown',
    iconColor: 'text-zinc-300',
    mimeType: 'text/markdown',
  },
  {
    id: 'c',
    label: 'C',
    extensions: ['.c', '.h'],
    monacoLanguage: 'c',
    iconColor: 'text-zinc-400',
    mimeType: 'text/x-csrc',
    braceFormatted: true,
  },
  {
    id: 'cpp',
    label: 'C++',
    extensions: ['.cpp', '.hpp'],
    monacoLanguage: 'cpp',
    iconColor: 'text-zinc-400',
    mimeType: 'text/x-c++src',
    braceFormatted: true,
  },
];

// Build lookup map for O(1) extension-based access
const extToConfig = new Map<string, LanguageConfig>();
for (const lang of languages) {
  for (const ext of lang.extensions) {
    extToConfig.set(ext, lang);
  }
}

/** Get the LanguageConfig for a file path based on its extension */
export function getLanguageForFile(path: string): LanguageConfig | undefined {
  const dotIndex = path.lastIndexOf('.');
  if (dotIndex < 0) return undefined;
  return extToConfig.get(path.slice(dotIndex));
}

/** Get the Monaco language ID for a file path (defaults to 'plaintext') */
export function getMonacoLanguage(path: string): string {
  return getLanguageForFile(path)?.monacoLanguage ?? 'plaintext';
}

/** Get the Tailwind icon color class for a file path */
export function getIconColor(path: string): string {
  return getLanguageForFile(path)?.iconColor ?? 'text-zinc-400';
}

/** Get the MIME type for a file path */
export function getMimeType(path: string): string {
  return getLanguageForFile(path)?.mimeType ?? 'text/plain';
}

/** The primary language — used for defaults, terminal branding, etc. */
export const primaryLanguage: LanguageConfig = languages[0];

export { languages };

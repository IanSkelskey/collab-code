import { useEffect, useRef, type MutableRefObject } from 'react';
import type { EditorHandle } from '../components/Editor';
import { getLanguageForFile } from '../config/languages';
import { parseJavaDiagnostics } from '../services/javaDiagnostics';
import { parsePythonRuntimeErrors } from '../services/pythonDiagnostics';
import { requestCheck, type ExecutionLanguageId } from '../services/interactiveExec';
import type { VirtualFS } from '../types/virtualFs';

const CHECK_DEBOUNCE_MS = 600;

interface UseLiveCheckOptions {
  fs: VirtualFS;
  editorRef: MutableRefObject<EditorHandle | null>;
}

/**
 * Live "as you type" compile-only check for the active file's language. Debounces
 * text changes ~600ms, sends the workspace files to the server's `check` path,
 * and applies the result through the existing diagnostic parsers and editor
 * markers — so the same red squiggles a failed Run produces also appear as you
 * type, without needing to hit Run.
 *
 * Java and Python only for now (their parsers are what we have). Other active
 * files clear any stale markers and skip the check.
 */
export function useLiveCheck({ fs, editorRef }: UseLiveCheckOptions): void {
  const activeFile = fs.activeFile;
  const language = getCheckableLanguage(activeFile);
  const activeContent = activeFile ? (fs.readFile(activeFile) ?? '') : '';

  // Keep a live ref to `fs` so the debounced callback reads files at the time
  // it fires (capturing the snapshot at scheduling time would mean checking
  // already-stale content if the user kept typing during the debounce).
  const fsRef = useRef(fs);
  useEffect(() => {
    fsRef.current = fs;
  }, [fs]);

  useEffect(() => {
    if (!language || !activeFile) {
      // Active file changed to something we can't check — drop any markers
      // left over from the previous file's language.
      editorRef.current?.clearMarkers();
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const files = fsRef.current.getAllFiles();

      try {
        const result = await requestCheck(files, language, controller.signal);
        if (controller.signal.aborted) return;

        const parser = language === 'java' ? parseJavaDiagnostics : parsePythonRuntimeErrors;
        const markers = parser(result.output);

        if (markers.length === 0) {
          editorRef.current?.clearMarkers();
        } else {
          editorRef.current?.setMarkers(markers);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Surface failures so a broken live-check is distinguishable from
        // "no errors". Same pattern as the markdown-preview colorize warn.
        console.warn('Live check failed', error);
      }
    }, CHECK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeFile, activeContent, language, editorRef]);
}

function getCheckableLanguage(filePath: string | null): ExecutionLanguageId | null {
  if (!filePath) return null;
  const id = getLanguageForFile(filePath)?.id;
  if (id === 'java') return 'java';
  if (id === 'python') return 'python';
  return null;
}

import { useCallback, useRef, useState, useMemo } from 'react';
import type { RefObject } from 'react';
import type { EditorHandle } from '../components/Editor';
import type { TerminalHandle } from '../components/Terminal';
import type { VirtualFS } from './useVirtualFS';
import { InteractiveExecutor } from '../services/interactiveExec';
import { primaryLanguage, getLanguageForFile } from '../config/languages';

interface UseExecutionOptions {
  fs: VirtualFS;
  terminalRef: RefObject<TerminalHandle | null>;
  editorRef: RefObject<EditorHandle | null>;
  setTerminalVisible: (visible: boolean) => void;
}

export function useExecution({ fs, terminalRef, editorRef, setTerminalVisible }: UseExecutionOptions) {
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const executorRef = useRef<InteractiveExecutor | null>(null);

  // Compute set of VFS paths that contain an entry point (reactive to file content changes)
  const entryPoints = useMemo(() => {
    const eps = new Set<string>();
    for (const filePath of fs.files) {
      const lang = getLanguageForFile(filePath);
      if (!lang?.entryPointPattern) continue;
      const content = fs.readFile(filePath);
      if (content && lang.entryPointPattern.test(content)) {
        eps.add(filePath);
      }
    }
    return eps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fs.files, fs.readFile, fs.contentVersion]);

  const handleRun = useCallback((explicitMainClass?: string) => {
    if (runningRef.current) return;

    const allFiles = fs.getAllFiles();
    const fileNames = Object.keys(allFiles);
    if (fileNames.length === 0 || fileNames.every(f => !allFiles[f].trim())) {
      terminalRef.current?.writeln('\x1b[33mNo code to run.\x1b[0m');
      return;
    }

    // Determine which class to run
    let mainClass = explicitMainClass;
    if (!mainClass) {
      const activeRel = fs.activeFile?.startsWith('~/') ? fs.activeFile.slice(2) : fs.activeFile;
      const activeLang = activeRel ? getLanguageForFile(activeRel) : undefined;
      if (activeRel && activeLang?.entryPointPattern && allFiles[activeRel] && activeLang.entryPointPattern.test(allFiles[activeRel])) {
        mainClass = activeLang.extractEntryPointName?.(activeRel) ?? activeRel.split('/').pop()!;
      } else {
        for (const [relPath, content] of Object.entries(allFiles)) {
          const lang = getLanguageForFile(relPath);
          if (lang?.entryPointPattern?.test(content)) {
            mainClass = lang.extractEntryPointName?.(relPath) ?? relPath.split('/').pop()!;
            break;
          }
        }
      }
    }

    setTerminalVisible(true);

    if (executorRef.current) {
      executorRef.current.close();
      executorRef.current = null;
    }

    runningRef.current = true;
    setRunning(true);
    editorRef.current?.clearMarkers();

    let compileOutput = '';
    let runtimeStderr = '';

    const executor = new InteractiveExecutor();
    executorRef.current = executor;

    const finish = () => {
      runningRef.current = false;
      setRunning(false);
      terminalRef.current?.exitExecMode();
      executorRef.current = null;
    };

    if (mainClass) {
      terminalRef.current?.writeln(`\x1b[2mEntry point: ${mainClass}\x1b[0m`);
    }

    executor.execute(allFiles, {
      onCompileStart() {
        terminalRef.current?.writeln('\x1b[1;36m▶ Compiling...\x1b[0m');
      },

      onCompileError(data) {
        compileOutput = data;
        terminalRef.current?.writeln('\x1b[1;31m── Compilation Error ──\x1b[0m');
        data.split('\n').forEach((line) => {
          terminalRef.current?.writeln(`\x1b[31m${line}\x1b[0m`);
        });

        const parseDiagnostics = primaryLanguage.parseDiagnostics;
        if (parseDiagnostics) {
          const allMarkers = parseDiagnostics(compileOutput);
          const activeFileName = fs.activeFile?.split('/').pop();
          const markers = activeFileName
            ? allMarkers.filter(m => !m.file || m.file === activeFileName)
            : allMarkers;
          if (markers.length > 0) editorRef.current?.setMarkers(markers);
        }

        finish();
      },

      onCompileOk() {
        terminalRef.current?.writeln('\x1b[1;32m── Running ──\x1b[0m');
        terminalRef.current?.enterExecMode(
          (data) => executor.sendStdin(data),
          () => executor.kill(),
        );
      },

      onStdout(data) {
        terminalRef.current?.write(data);
      },

      onStderr(data) {
        runtimeStderr += data;
        terminalRef.current?.write(`\x1b[31m${data}\x1b[0m`);
      },

      onExit(code) {
        if (code !== 0 && code !== null) {
          terminalRef.current?.writeln(
            `\n\x1b[33mProcess exited with code ${code}\x1b[0m`
          );
        } else {
          terminalRef.current?.writeln('');
        }

        const parseRuntimeErrors = primaryLanguage.parseRuntimeErrors;
        if (parseRuntimeErrors) {
          const allRtMarkers = parseRuntimeErrors(runtimeStderr);
          const activeRtFile = fs.activeFile?.split('/').pop();
          const rtMarkers = activeRtFile
            ? allRtMarkers.filter(m => !m.file || m.file === activeRtFile)
            : allRtMarkers;
          if (rtMarkers.length > 0) editorRef.current?.setMarkers(rtMarkers);
        }

        finish();
      },

      onFilesSync(syncedFiles) {
        let count = 0;
        for (const [relPath, content] of Object.entries(syncedFiles)) {
          const vfsPath = '~/' + relPath;
          fs.writeFile(vfsPath, content);
          count++;
        }
        if (count > 0) {
          terminalRef.current?.writeln(
            `\x1b[2m[${count} file(s) synced to workspace]\x1b[0m`
          );
        }
      },

      onError(error) {
        terminalRef.current?.writeln(`\x1b[31mExecution failed: ${error}\x1b[0m`);
        finish();
      },
    }, mainClass);
  }, [fs, terminalRef, editorRef, setTerminalVisible, entryPoints]);

  return { running, entryPoints, handleRun };
}

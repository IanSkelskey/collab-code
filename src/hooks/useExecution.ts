import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Y from 'yjs';
import type { RefObject } from 'react';
import type { EditorHandle } from '../components/Editor';
import type { TerminalHandle } from '../components/Terminal';
import type { VirtualFS } from './useVirtualFS';
import { InteractiveExecutor } from '../services/interactiveExec';
import { primaryLanguage, getLanguageForFile } from '../config/languages';
import { getBaseName, stripVfsRoot } from '../lib/vfsPaths';
import {
  createTerminalRunId,
  getTerminalStateMap,
  readSharedTerminalSnapshot,
  updateSharedTerminalState,
} from '../services/sharedTerminal';

interface UseExecutionOptions {
  ydoc: Y.Doc;
  fs: VirtualFS;
  terminalRef: RefObject<TerminalHandle | null>;
  editorRef: RefObject<EditorHandle | null>;
  setTerminalVisible: (visible: boolean) => void;
}

export function useExecution({ ydoc, fs, terminalRef, editorRef, setTerminalVisible }: UseExecutionOptions) {
  const [running, setRunning] = useState(() => readSharedTerminalSnapshot(ydoc).running);
  const executorRef = useRef<InteractiveExecutor | null>(null);

  useEffect(() => {
    const terminalState = getTerminalStateMap(ydoc);
    const syncRunning = () => {
      setRunning(readSharedTerminalSnapshot(ydoc).running);
    };

    terminalState.observe(syncRunning);
    syncRunning();

    return () => {
      terminalState.unobserve(syncRunning);
    };
  }, [ydoc]);

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
    if (readSharedTerminalSnapshot(ydoc).running) {
      return;
    }

    const allFiles = fs.getAllFiles();
    const fileNames = Object.keys(allFiles);
    if (fileNames.length === 0 || fileNames.every((fileName) => !allFiles[fileName].trim())) {
      terminalRef.current?.writeln('\x1b[33mNo code to run.\x1b[0m');
      return;
    }

    let mainClass = explicitMainClass;
    if (!mainClass) {
      const activeRel = fs.activeFile ? stripVfsRoot(fs.activeFile) : null;
      const activeLang = activeRel ? getLanguageForFile(activeRel) : undefined;
      if (activeRel && activeLang?.entryPointPattern && allFiles[activeRel] && activeLang.entryPointPattern.test(allFiles[activeRel])) {
        mainClass = activeLang.extractEntryPointName?.(activeRel) ?? getBaseName(activeRel);
      } else {
        for (const [relPath, content] of Object.entries(allFiles)) {
          const lang = getLanguageForFile(relPath);
          if (lang?.entryPointPattern?.test(content)) {
            mainClass = lang.extractEntryPointName?.(relPath) ?? getBaseName(relPath);
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

    const runId = createTerminalRunId(ydoc.clientID);

    updateSharedTerminalState(ydoc, (current) => ({
      ...current,
      running: true,
      mode: 'command',
      execBuffer: '',
      execCursor: 0,
      execOwner: ydoc.clientID,
      runId,
    }));

    editorRef.current?.clearMarkers();

    let compileOutput = '';
    let runtimeStderr = '';

    const executor = new InteractiveExecutor();
    executorRef.current = executor;

    const finish = () => {
      const snapshot = readSharedTerminalSnapshot(ydoc);
      if (snapshot.runId !== runId || snapshot.execOwner !== ydoc.clientID) {
        executorRef.current = null;
        return;
      }

      terminalRef.current?.exitExecMode();
      updateSharedTerminalState(ydoc, (current) => {
        if (current.runId !== runId || current.execOwner !== ydoc.clientID) {
          return current;
        }

        return {
          ...current,
          running: false,
          mode: 'command',
          execBuffer: '',
          execCursor: 0,
          execOwner: null,
          runId: null,
        };
      });

      executorRef.current = null;
    };

    if (mainClass) {
      terminalRef.current?.writeln(`\x1b[2mEntry point: ${mainClass}\x1b[0m`);
    }

    executor.execute(allFiles, {
      onCompileStart() {
        terminalRef.current?.writeln('\x1b[1;36m> Compiling...\x1b[0m');
      },

      onCompileError(data) {
        compileOutput = data;
        terminalRef.current?.writeln('\x1b[1;31m-- Compilation Error --\x1b[0m');
        data.split('\n').forEach((line) => {
          terminalRef.current?.writeln(`\x1b[31m${line}\x1b[0m`);
        });

        const parseDiagnostics = primaryLanguage.parseDiagnostics;
        if (parseDiagnostics) {
          const markers = parseDiagnostics(compileOutput);
          if (markers.length > 0) editorRef.current?.setMarkers(markers);
        }

        finish();
      },

      onCompileOk() {
        terminalRef.current?.writeln('\x1b[1;32m-- Running --\x1b[0m');
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
          terminalRef.current?.writeln(`\n\x1b[33mProcess exited with code ${code}\x1b[0m`);
        } else {
          terminalRef.current?.writeln('');
        }

        const parseRuntimeErrors = primaryLanguage.parseRuntimeErrors;
        if (parseRuntimeErrors) {
          const markers = parseRuntimeErrors(runtimeStderr);
          if (markers.length > 0) editorRef.current?.setMarkers(markers);
        }

        finish();
      },

      onFilesSync(syncedFiles) {
        let count = 0;
        for (const [relPath, content] of Object.entries(syncedFiles)) {
          const vfsPath = `~/${relPath}`;
          fs.writeFile(vfsPath, content);
          count += 1;
        }
        if (count > 0) {
          terminalRef.current?.writeln(`\x1b[2m[${count} file(s) synced to workspace]\x1b[0m`);
        }
      },

      onError(error) {
        terminalRef.current?.writeln(`\x1b[31mExecution failed: ${error}\x1b[0m`);
        finish();
      },
    }, mainClass);
  }, [editorRef, fs, setTerminalVisible, terminalRef, ydoc]);

  return { running, entryPoints, handleRun };
}

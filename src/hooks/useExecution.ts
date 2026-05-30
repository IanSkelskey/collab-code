import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Y from 'yjs';
import type { RefObject } from 'react';
import type { EditorHandle } from '../components/Editor';
import type { TerminalHandle } from '../components/Terminal';
import type { VirtualFS } from './useVirtualFS';
import { InteractiveExecutor } from '../services/interactiveExec';
import { getLanguageForFile, type LanguageConfig } from '../config/languages';
import { getBaseName, normalizeVfsPath, stripVfsRoot } from '../lib/vfsPaths';
import { formatMuted } from '../services/terminalCommandOutput';
import type { ServerFetchState, ServerRuntimeInfo } from '../types/serverStatus';
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
  serverFetchState: ServerFetchState;
  serverRuntimes: ServerRuntimeInfo[];
}

export interface ExecutionTarget {
  filePath: string;
  language: LanguageConfig;
  entryPoint: string;
}

interface RunResolutionResult {
  target: ExecutionTarget | null;
  error: string | null;
}

function buildClientExecutionTarget(
  filePath: string,
  allFiles: Record<string, string>,
): ExecutionTarget | null {
  const normalizedPath = normalizeVfsPath(filePath);
  const relativePath = stripVfsRoot(normalizedPath);
  const language = getLanguageForFile(relativePath);
  const content = allFiles[relativePath];

  if (
    !language ||
    !language.runnable ||
    !language.entryPointPattern ||
    !content ||
    !language.entryPointPattern.test(content)
  ) {
    return null;
  }

  return {
    filePath: normalizedPath,
    language,
    entryPoint: language.extractEntryPointName?.(relativePath) ?? getBaseName(relativePath),
  };
}

function getRuntimeStatusRunError(
  serverFetchState: ServerFetchState,
  serverRunnableLanguageIds: Set<string>,
): string | null {
  if (serverFetchState === 'idle' || serverFetchState === 'loading') {
    return 'Checking execution server runtimes. Try again in a moment.';
  }

  if (serverFetchState === 'error') {
    return 'Execution server could not be reached.';
  }

  if (serverRunnableLanguageIds.size === 0) {
    return 'No runnable language runtimes are available on this server.';
  }

  return null;
}

export function useExecution({
  ydoc,
  fs,
  terminalRef,
  editorRef,
  setTerminalVisible,
  serverFetchState,
  serverRuntimes,
}: UseExecutionOptions) {
  const [running, setRunning] = useState(() => readSharedTerminalSnapshot(ydoc).running);
  const [preferredRunFile, setPreferredRunFile] = useState<string | null>(null);
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

  const allFiles = fs.getAllFiles();

  const serverRunnableLanguageIds = useMemo(() => {
    return new Set(
      serverRuntimes
        .filter((runtime) => runtime.available === true && runtime.canRun)
        .map((runtime) => runtime.language),
    );
  }, [serverRuntimes]);

  const clientRunnableTargets = useMemo(() => {
    const targets: ExecutionTarget[] = [];

    for (const filePath of fs.files) {
      const target = buildClientExecutionTarget(filePath, allFiles);
      if (target) {
        targets.push(target);
      }
    }

    targets.sort((left, right) => left.filePath.localeCompare(right.filePath));
    return targets;
  }, [allFiles, fs.files]);

  const clientRunnableTargetsByPath = useMemo(() => {
    return new Map(clientRunnableTargets.map((target) => [target.filePath, target]));
  }, [clientRunnableTargets]);

  const runnableTargets = useMemo(() => {
    return clientRunnableTargets.filter((target) =>
      serverRunnableLanguageIds.has(target.language.id),
    );
  }, [clientRunnableTargets, serverRunnableLanguageIds]);

  const entryPoints = useMemo(
    () => new Set(runnableTargets.map((target) => target.filePath)),
    [runnableTargets],
  );

  const runnableTargetsByPath = useMemo(() => {
    return new Map(runnableTargets.map((target) => [target.filePath, target]));
  }, [runnableTargets]);

  useEffect(() => {
    if (!preferredRunFile) {
      return;
    }

    if (!runnableTargetsByPath.has(preferredRunFile)) {
      setPreferredRunFile(null);
    }
  }, [preferredRunFile, runnableTargetsByPath]);

  const currentRunTarget = useMemo(() => {
    if (preferredRunFile) {
      const preferredTarget = runnableTargetsByPath.get(preferredRunFile);
      if (preferredTarget) {
        return preferredTarget;
      }
    }

    if (fs.activeFile) {
      const activeTarget = runnableTargetsByPath.get(fs.activeFile);
      if (activeTarget) {
        return activeTarget;
      }
    }

    if (runnableTargets.length === 1) {
      return runnableTargets[0];
    }

    return null;
  }, [fs.activeFile, preferredRunFile, runnableTargets, runnableTargetsByPath]);

  const resolveRunTarget = useCallback(
    (explicitFilePath?: string): RunResolutionResult => {
      const runtimeStatusError = getRuntimeStatusRunError(
        serverFetchState,
        serverRunnableLanguageIds,
      );

      if (explicitFilePath) {
        const normalizedPath = normalizeVfsPath(explicitFilePath);
        const explicitTarget = runnableTargetsByPath.get(normalizedPath);

        if (explicitTarget) {
          return { target: explicitTarget, error: null };
        }

        if (!fs.exists(normalizedPath)) {
          return { target: null, error: `File not found: ${normalizedPath}` };
        }

        if (fs.isDirectory(normalizedPath)) {
          return { target: null, error: `Cannot run a folder: ${normalizedPath}` };
        }

        const clientTarget = clientRunnableTargetsByPath.get(normalizedPath);
        if (clientTarget) {
          return {
            target: null,
            error:
              runtimeStatusError ??
              `${clientTarget.language.label} is not available on this execution server.`,
          };
        }

        return {
          target: null,
          error: `File is not a runnable entry point: ${normalizedPath}`,
        };
      }

      if (currentRunTarget) {
        return { target: currentRunTarget, error: null };
      }

      if (runnableTargets.length > 1) {
        return {
          target: null,
          error:
            'Multiple runnable files found. Use run <file> or choose a target from the Run menu.',
        };
      }

      if (fs.activeFile && fs.exists(fs.activeFile) && !runnableTargetsByPath.has(fs.activeFile)) {
        const activeClientTarget = clientRunnableTargetsByPath.get(fs.activeFile);
        if (activeClientTarget) {
          return {
            target: null,
            error:
              runtimeStatusError ??
              `${activeClientTarget.language.label} is not available on this execution server.`,
          };
        }

        return {
          target: null,
          error: `Active file is not runnable: ${fs.activeFile}. Use run <file> or choose a target from the Run menu.`,
        };
      }

      if (clientRunnableTargets.length > 0 && runtimeStatusError) {
        return { target: null, error: runtimeStatusError };
      }

      return { target: null, error: 'No runnable file found.' };
    },
    [
      clientRunnableTargets.length,
      clientRunnableTargetsByPath,
      currentRunTarget,
      fs,
      runnableTargets.length,
      runnableTargetsByPath,
      serverFetchState,
      serverRunnableLanguageIds,
    ],
  );

  const handleRun = useCallback(
    (explicitFilePath?: string) => {
      if (readSharedTerminalSnapshot(ydoc).running) {
        return;
      }

      const fileNames = Object.keys(allFiles);
      if (fileNames.length === 0 || fileNames.every((fileName) => !allFiles[fileName].trim())) {
        setTerminalVisible(true);
        terminalRef.current?.writeln('\x1b[33mNo code to run.\x1b[0m');
        return;
      }

      const resolution = resolveRunTarget(explicitFilePath);
      if (!resolution.target) {
        setTerminalVisible(true);
        terminalRef.current?.writeln(`\x1b[33m${resolution.error}\x1b[0m`);
        return;
      }

      const target = resolution.target;
      setPreferredRunFile(target.filePath);
      setTerminalVisible(true);

      if (executorRef.current) {
        executorRef.current.close();
        executorRef.current = null;
      }

      const runId = createTerminalRunId(ydoc.clientID);
      const executionLanguage = target.language;

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

      terminalRef.current?.writeln(formatMuted(`Target file: ${target.filePath}`));
      terminalRef.current?.writeln(formatMuted(`Entry point: ${target.entryPoint}`));

      executor.execute(
        allFiles,
        {
          onCompileStart() {
            const preparingLabel =
              executionLanguage.id === 'java' ? 'Compiling' : 'Preparing runtime for';
            terminalRef.current?.writeln(
              `\x1b[1;36m> ${preparingLabel} ${getBaseName(target.filePath)}...\x1b[0m`,
            );
          },

          onCompileError(data) {
            compileOutput = data;
            terminalRef.current?.writeln('\x1b[1;31m-- Compilation Error --\x1b[0m');
            data.split('\n').forEach((line) => {
              terminalRef.current?.writeln(`\x1b[31m${line}\x1b[0m`);
            });

            const parseDiagnostics = executionLanguage.parseDiagnostics;
            if (parseDiagnostics) {
              const markers = parseDiagnostics(compileOutput);
              if (markers.length > 0) editorRef.current?.setMarkers(markers);
            }

            finish();
          },

          onCompileOk() {
            terminalRef.current?.writeln(
              `\x1b[1;32m-- Running ${getBaseName(target.filePath)} --\x1b[0m`,
            );
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

            const parseRuntimeErrors = executionLanguage.parseRuntimeErrors;
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
              terminalRef.current?.writeln(formatMuted(`[${count} file(s) synced to workspace]`));
            }
          },

          onError(error) {
            terminalRef.current?.writeln(`\x1b[31mExecution failed: ${error}\x1b[0m`);
            finish();
          },
        },
        {
          language: executionLanguage.id,
          entryPoint: target.entryPoint,
        },
      );
    },
    [allFiles, editorRef, fs, resolveRunTarget, setTerminalVisible, terminalRef, ydoc],
  );

  const handleRunActiveFile = useCallback(() => {
    if (fs.activeFile) {
      handleRun(fs.activeFile);
      return;
    }

    setTerminalVisible(true);
    terminalRef.current?.writeln('\x1b[33mNo active file to run.\x1b[0m');
  }, [fs.activeFile, handleRun, setTerminalVisible, terminalRef]);

  return {
    running,
    entryPoints,
    runnableTargets,
    currentRunTarget,
    handleRun,
    handleRunActiveFile,
  };
}

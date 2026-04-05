import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { useCollab } from '../context/CollabContext';
import type { PushToast } from '../types/toast';
import {
  appendTerminalOutput,
  buildTerminalPrompt,
  clearTerminalTranscript,
  getTerminalExecEvents,
  getTerminalStateMap,
  getTerminalTranscript,
  readSharedTerminalSnapshot,
  renderSharedTerminal,
  type SharedTerminalSnapshot,
  updateSharedTerminalState,
} from '../services/sharedTerminal';
import {
  createTerminalDataHandler,
  createTerminalKeyGuard,
} from '../services/terminalInput';
import { useTheme } from '../theme/ThemeProvider';

export interface TerminalHandle {
  write: (text: string) => void;
  writeln: (text: string) => void;
  clear: () => void;
  enterExecMode: (onStdin: (data: string) => void, onKill: () => void) => void;
  exitExecMode: (options?: { appendNewline?: boolean }) => void;
}

interface TerminalProps {
  onRunRequested?: (filePath?: string) => void;
  fontSize?: number;
  fs?: VirtualFS;
  pushToast?: PushToast;
  requestConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

type SyncTerminal = XTerminal & {
  writeSync?: (data: string | Uint8Array, maxSubsequentCalls?: number) => void;
};

const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { onRunRequested, fontSize, fs, pushToast, requestConfirm },
  ref,
) {
  const { ydoc } = useCollab();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const initialFontSizeRef = useRef(fontSize ?? (window.innerWidth < 640 ? 11 : 13));
  const initialTerminalThemeRef = useRef(theme.terminalTheme);
  const onRunRef = useRef(onRunRequested);
  const fsRef = useRef(fs);
  const pushToastRef = useRef(pushToast);
  const requestConfirmRef = useRef(requestConfirm);
  const execStdinCallbackRef = useRef<((data: string) => void) | null>(null);
  const execKillCallbackRef = useRef<(() => void) | null>(null);
  const execEventIndexRef = useRef(0);
  const renderedContentRef = useRef<string | null>(null);
  const renderedSnapshotRef = useRef<SharedTerminalSnapshot | null>(null);
  const renderedTranscriptRef = useRef<string | null>(null);
  const renderFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onRunRef.current = onRunRequested;
  }, [onRunRequested]);

  useEffect(() => {
    fsRef.current = fs;
  }, [fs]);

  useEffect(() => {
    pushToastRef.current = pushToast;
  }, [pushToast]);

  useEffect(() => {
    requestConfirmRef.current = requestConfirm;
  }, [requestConfirm]);

  const renderTerminalView = useCallback(() => {
    const terminal = termRef.current;
    if (!terminal) {
      return;
    }

    const transcript = getTerminalTranscript(ydoc).toString();
    const snapshot = readSharedTerminalSnapshot(ydoc);
    const content = renderSharedTerminal(snapshot, transcript);

    if (content === renderedContentRef.current) {
      return;
    }

    const previousSnapshot = renderedSnapshotRef.current;
    const previousTranscript = renderedTranscriptRef.current;

    if (
      previousSnapshot
      && previousTranscript === transcript
      && canPatchActiveLine(terminal, previousSnapshot, snapshot)
    ) {
      patchActiveLine(terminal, snapshot);
      renderedSnapshotRef.current = snapshot;
      renderedTranscriptRef.current = transcript;
      renderedContentRef.current = content;
      return;
    }

    renderedContentRef.current = content;
    renderedSnapshotRef.current = snapshot;
    renderedTranscriptRef.current = transcript;
    terminal.reset();
    if (content) {
      const syncTerminal = terminal as SyncTerminal;
      if (typeof syncTerminal.writeSync === 'function') {
        syncTerminal.writeSync(content);
      } else {
        terminal.write(content);
      }
    }
  }, [ydoc]);

  const scheduleRenderTerminalView = useCallback(() => {
    if (renderFrameRef.current !== null) {
      return;
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      renderTerminalView();
    });
  }, [renderTerminalView]);

  useImperativeHandle(ref, () => ({
    write(text: string) {
      appendTerminalOutput(ydoc, text);
    },
    writeln(text: string) {
      appendTerminalOutput(ydoc, `${text}\r\n`);
    },
    clear() {
      clearTerminalTranscript(ydoc);
      updateSharedTerminalState(ydoc, (current) => ({
        ...current,
        commandBuffer: '',
        commandCursor: 0,
        execBuffer: '',
        execCursor: 0,
        historyIndex: -1,
        savedInput: '',
        mode: 'command',
      }));
    },
    enterExecMode(onStdin: (data: string) => void, onKill: () => void) {
      execStdinCallbackRef.current = onStdin;
      execKillCallbackRef.current = onKill;

      updateSharedTerminalState(ydoc, (current) => ({
        ...current,
        mode: 'exec',
        execBuffer: '',
        execCursor: 0,
      }));
    },
    exitExecMode(options?: { appendNewline?: boolean }) {
      execStdinCallbackRef.current = null;
      execKillCallbackRef.current = null;

      if (options?.appendNewline !== false) {
        appendTerminalOutput(ydoc, '\r\n');
      }

      updateSharedTerminalState(ydoc, (current) => ({
        ...current,
        mode: 'command',
        execBuffer: '',
        execCursor: 0,
      }));
    },
  }), [ydoc]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const terminal = new XTerminal({
      cursorBlink: true,
      fontSize: initialFontSizeRef.current,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      theme: initialTerminalThemeRef.current,
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore initial layout races while the container is mounting.
      }
    });

    termRef.current = terminal;
    fitRef.current = fitAddon;

    terminal.attachCustomKeyEventHandler(createTerminalKeyGuard({
      getSnapshot: () => readSharedTerminalSnapshot(ydoc),
    }));

    const dataDisposable = terminal.onData(createTerminalDataHandler({
      ydoc,
      getVfs: () => fsRef.current,
      getOnRun: () => onRunRef.current,
      getPushToast: () => pushToastRef.current,
      getRequestConfirm: () => requestConfirmRef.current,
    }));

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore transient observer callbacks during teardown.
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
      resizeObserver.disconnect();
      dataDisposable.dispose();
      terminal.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [renderTerminalView, ydoc]);

  useEffect(() => {
    const terminalState = getTerminalStateMap(ydoc);
    const transcript = getTerminalTranscript(ydoc);
    const rerender = () => {
      scheduleRenderTerminalView();
    };

    terminalState.observe(rerender);
    transcript.observe(rerender);
    rerender();

    return () => {
      terminalState.unobserve(rerender);
      transcript.unobserve(rerender);
    };
  }, [scheduleRenderTerminalView, ydoc]);

  useEffect(() => {
    const execEvents = getTerminalExecEvents(ydoc);
    execEventIndexRef.current = execEvents.length;

    const flushExecEvents = () => {
      const snapshot = readSharedTerminalSnapshot(ydoc);
      if (snapshot.execOwner !== ydoc.clientID || !snapshot.runId) {
        execEventIndexRef.current = execEvents.length;
        return;
      }

      while (execEventIndexRef.current < execEvents.length) {
        const event = execEvents.get(execEventIndexRef.current);
        execEventIndexRef.current += 1;

        if (!event || event.runId !== snapshot.runId) {
          continue;
        }

        if (event.type === 'stdin') {
          execStdinCallbackRef.current?.(event.data ?? '');
          continue;
        }

        execKillCallbackRef.current?.();
      }
    };

    execEvents.observe(flushExecEvents);
    return () => {
      execEvents.unobserve(flushExecEvents);
    };
  }, [ydoc]);

  useEffect(() => {
    const terminal = termRef.current;
    const fitAddon = fitRef.current;
    if (!terminal || !fitAddon || fontSize == null) {
      return;
    }

    terminal.options.fontSize = fontSize;
    try {
      fitAddon.fit();
    } catch {
      // Ignore layout races while the terminal container is resizing.
    }
  }, [fontSize]);

  useEffect(() => {
    const terminal = termRef.current;
    if (!terminal) {
      return;
    }

    terminal.options.theme = theme.terminalTheme;
    scheduleRenderTerminalView();
  }, [scheduleRenderTerminalView, theme.terminalTheme]);

  return (
    <div className="cc-terminal-shell">
      <div ref={containerRef} className="cc-terminal-canvas" />
    </div>
  );
});

export default Terminal;

function canPatchActiveLine(
  terminal: XTerminal,
  previousSnapshot: SharedTerminalSnapshot,
  nextSnapshot: SharedTerminalSnapshot,
): boolean {
  if (!previousSnapshot.initialized || !nextSnapshot.initialized) {
    return false;
  }

  if (previousSnapshot.mode !== nextSnapshot.mode && (previousSnapshot.mode === 'exec' || nextSnapshot.mode === 'exec')) {
    return false;
  }

  return getVisibleLineLength(previousSnapshot) < terminal.cols
    && getVisibleLineLength(nextSnapshot) < terminal.cols;
}

function patchActiveLine(terminal: XTerminal, snapshot: SharedTerminalSnapshot): void {
  const syncTerminal = terminal as SyncTerminal;
  const buffer = snapshot.mode === 'exec'
    ? { text: snapshot.execBuffer, cursor: snapshot.execCursor }
    : { text: snapshot.commandBuffer, cursor: snapshot.commandCursor };

  const prompt = snapshot.mode === 'command' ? buildTerminalPrompt(snapshot.cwd) : '';
  const backtrack = buffer.text.length - buffer.cursor;
  const nextLine = `\r\x1b[2K${prompt}${buffer.text}`;

  if (typeof syncTerminal.writeSync === 'function') {
    syncTerminal.writeSync(nextLine);
    if (backtrack > 0) {
      syncTerminal.writeSync(`\x1b[${backtrack}D`);
    }
    return;
  }

  terminal.write(nextLine);
  if (backtrack > 0) {
    terminal.write(`\x1b[${backtrack}D`);
  }
}

function getVisibleLineLength(snapshot: SharedTerminalSnapshot): number {
  const promptLength = snapshot.mode === 'command' ? `${snapshot.cwd} $ `.length : 0;
  const bufferLength = snapshot.mode === 'exec'
    ? snapshot.execBuffer.length
    : snapshot.commandBuffer.length;

  return promptLength + bufferLength;
}

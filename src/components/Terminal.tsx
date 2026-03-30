import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { printWelcome } from '../services/terminalCommands';
import { clearBuffer } from '../services/terminalBuffer';
import {
  createTerminalDataHandler,
  createTerminalKeyGuard,
  type TerminalInputRefs,
} from '../services/terminalInput';

export interface TerminalHandle {
  write: (text: string) => void;
  writeln: (text: string) => void;
  clear: () => void;
  enterExecMode: (onStdin: (data: string) => void, onKill: () => void) => void;
  exitExecMode: () => void;
}

interface TerminalProps {
  onRunRequested?: () => void;
  fontSize?: number;
  fs?: VirtualFS;
  pushToast?: (label: string, onUndo?: () => void) => void;
  requestConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { onRunRequested, fontSize, fs, pushToast, requestConfirm },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const initialFontSizeRef = useRef(fontSize ?? (window.innerWidth < 640 ? 11 : 13));
  const onRunRef = useRef(onRunRequested);
  const fsRef = useRef(fs);
  const pushToastRef = useRef(pushToast);
  const requestConfirmRef = useRef(requestConfirm);

  const commandTextRef = useRef('');
  const commandCursorRef = useRef(0);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const savedInputRef = useRef('');

  const execTextRef = useRef('');
  const execCursorRef = useRef(0);
  const execStdinCallbackRef = useRef<((data: string) => void) | null>(null);
  const execKillCallbackRef = useRef<(() => void) | null>(null);

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

  const inputRefs = useMemo<TerminalInputRefs>(() => ({
    commandBuffer: {
      text: commandTextRef,
      cursor: commandCursorRef,
    },
    execBuffer: {
      text: execTextRef,
      cursor: execCursorRef,
    },
    commandHistory: commandHistoryRef,
    historyIndex: historyIndexRef,
    savedInput: savedInputRef,
    execStdinCallback: execStdinCallbackRef,
    execKillCallback: execKillCallbackRef,
  }), []);

  const writePrompt = useCallback((cwdOverride?: string) => {
    const cwd = cwdOverride ?? fsRef.current?.cwd ?? '~';
    termRef.current?.write(`\x1b[38;2;86;182;194m${cwd} $ \x1b[0m`);
  }, []);

  useImperativeHandle(ref, () => ({
    write(text: string) {
      termRef.current?.write(text);
    },
    writeln(text: string) {
      termRef.current?.writeln(text);
    },
    clear() {
      clearBuffer(inputRefs.commandBuffer);
      clearBuffer(inputRefs.execBuffer);
      termRef.current?.clear();
      writePrompt();
    },
    enterExecMode(onStdin: (data: string) => void, onKill: () => void) {
      execStdinCallbackRef.current = onStdin;
      execKillCallbackRef.current = onKill;
      clearBuffer(inputRefs.execBuffer);
    },
    exitExecMode() {
      execStdinCallbackRef.current = null;
      execKillCallbackRef.current = null;
      clearBuffer(inputRefs.execBuffer);
      termRef.current?.write('\r\n');
      writePrompt();
    },
  }), [inputRefs, writePrompt]);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new XTerminal({
      cursorBlink: true,
      fontSize: initialFontSizeRef.current,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#56b6c2',
        selectionBackground: '#3e4451',
      },
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

    printWelcome(terminal);
    termRef.current = terminal;
    fitRef.current = fitAddon;
    writePrompt('~');

    terminal.attachCustomKeyEventHandler(createTerminalKeyGuard({ refs: inputRefs }));
    const dataDisposable = terminal.onData(createTerminalDataHandler({
      term: terminal,
      refs: inputRefs,
      getVfs: () => fsRef.current,
      getOnRun: () => onRunRef.current,
      getPushToast: () => pushToastRef.current,
      getRequestConfirm: () => requestConfirmRef.current,
      writePrompt,
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
      resizeObserver.disconnect();
      dataDisposable.dispose();
      terminal.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [inputRefs, writePrompt]);

  useEffect(() => {
    const terminal = termRef.current;
    const fitAddon = fitRef.current;
    if (!terminal || !fitAddon || fontSize == null) return;

    terminal.options.fontSize = fontSize;
    try {
      fitAddon.fit();
    } catch {
      // Ignore layout races while the terminal container is resizing.
    }
  }, [fontSize]);

  return <div ref={containerRef} className="h-full w-full p-1 sm:p-2" />;
});

export default Terminal;

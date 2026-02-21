import {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { executeCommand, printWelcome } from '../services/terminalCommands';

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
  pushToast?: (label: string, onUndo: () => void) => void;
  requestConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  function Terminal({ onRunRequested, fontSize, fs, pushToast, requestConfirm }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const inputBuffer = useRef('');
    // Use a ref for the callback so the terminal effect doesn't re-run on every change
    const onRunRef = useRef(onRunRequested);
    useEffect(() => { onRunRef.current = onRunRequested; }, [onRunRequested]);

    // Keep fs in a ref so terminal commands always see the latest version
    const fsRef = useRef(fs);
    useEffect(() => { fsRef.current = fs; }, [fs]);

    // Keep toast/confirm callbacks in refs
    const pushToastRef = useRef(pushToast);
    useEffect(() => { pushToastRef.current = pushToast; }, [pushToast]);
    const requestConfirmRef = useRef(requestConfirm);
    useEffect(() => { requestConfirmRef.current = requestConfirm; }, [requestConfirm]);

    // Command history
    const commandHistory = useRef<string[]>([]);
    const historyIndex = useRef(-1);
    const savedInput = useRef('');

    // Exec mode refs — active while a Java process is running
    const execStdinCallback = useRef<((data: string) => void) | null>(null);
    const execKillCallback = useRef<(() => void) | null>(null);
    const execLineBuffer = useRef('');

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
        termRef.current?.clear();
        writePrompt();
      },
      enterExecMode(onStdin: (data: string) => void, onKill: () => void) {
        execStdinCallback.current = onStdin;
        execKillCallback.current = onKill;
        execLineBuffer.current = '';
      },
      exitExecMode() {
        execStdinCallback.current = null;
        execKillCallback.current = null;
        execLineBuffer.current = '';
        termRef.current?.write('\r\n');
        writePrompt();
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const term = new XTerminal({
        cursorBlink: true,
        fontSize: fontSize ?? (window.innerWidth < 640 ? 11 : 13),
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

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);

      // Initial fit after a small delay to ensure container has dimensions
      requestAnimationFrame(() => {
        try { fit.fit(); } catch { /* container not ready */ }
      });

      printWelcome(term);
      writePrompt();

      // Handle user input
      term.onData((data) => {
        const code = data.charCodeAt(0);

        // ── Interactive execution mode ──
        if (execStdinCallback.current) {
          if (code === 3) {
            // Ctrl+C → kill running process
            term.write('^C');
            execKillCallback.current?.();
            return;
          }
          if (code === 13) {
            // Enter → send buffered line as stdin
            term.write('\r\n');
            const line = execLineBuffer.current + '\n';
            execLineBuffer.current = '';
            execStdinCallback.current(line);
            return;
          }
          if (code === 127) {
            // Backspace
            if (execLineBuffer.current.length > 0) {
              execLineBuffer.current = execLineBuffer.current.slice(0, -1);
              term.write('\b \b');
            }
            return;
          }
          if (code >= 32) {
            // Printable character — echo and buffer
            execLineBuffer.current += data;
            term.write(data);
          }
          return;
        }

        // ── Normal command mode ──

        // Arrow keys arrive as escape sequences
        if (data === '\x1b[A' || data === '\x1b[B') {
          const history = commandHistory.current;
          if (history.length === 0) return;

          if (data === '\x1b[A') {
            // Up — go back in history
            if (historyIndex.current === -1) {
              // Save whatever the user was typing
              savedInput.current = inputBuffer.current;
              historyIndex.current = history.length - 1;
            } else if (historyIndex.current > 0) {
              historyIndex.current--;
            } else {
              return; // Already at oldest
            }
          } else {
            // Down — go forward in history
            if (historyIndex.current === -1) return; // Nothing to navigate
            if (historyIndex.current < history.length - 1) {
              historyIndex.current++;
            } else {
              // Past newest — restore saved input
              historyIndex.current = -1;
            }
          }

          // Erase the current input on screen
          const eraseLen = inputBuffer.current.length;
          if (eraseLen > 0) term.write('\b \b'.repeat(eraseLen));

          // Replace with history entry or saved input
          const replacement = historyIndex.current === -1
            ? savedInput.current
            : history[historyIndex.current];
          inputBuffer.current = replacement;
          term.write(replacement);
          return;
        }

        if (code === 13) {
          // Enter
          term.write('\r\n');
          const raw = inputBuffer.current.trim();
          inputBuffer.current = '';

          // Push to history (skip duplicates of the last entry)
          if (raw && raw !== commandHistory.current[commandHistory.current.length - 1]) {
            commandHistory.current.push(raw);
            // Cap at 100 entries
            if (commandHistory.current.length > 100) commandHistory.current.shift();
          }
          historyIndex.current = -1;
          savedInput.current = '';

          const parts = raw.split(/\s+/);
          const cmd = parts[0]?.toLowerCase() ?? '';
          const arg = parts.slice(1).join(' ');

          executeCommand(cmd, {
            term,
            arg,
            vfs: fsRef.current,
            writePrompt,
            onRun: onRunRef.current,
            pushToast: pushToastRef.current,
            requestConfirm: requestConfirmRef.current,
          });
        } else if (code === 127) {
          // Backspace
          if (inputBuffer.current.length > 0) {
            inputBuffer.current = inputBuffer.current.slice(0, -1);
            term.write('\b \b');
          }
        } else if (code === 27) {
          // Escape sequence — ignore (Left/Right/etc already handled above)
        } else if (code >= 32) {
          // Printable chars
          inputBuffer.current += data;
          term.write(data);
        }
      });

      termRef.current = term;
      fitRef.current = fit;

      // Resize observer
      const ro = new ResizeObserver(() => {
        try { fit.fit(); } catch { /* ignore */ }
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        term.dispose();
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [writePrompt]);

    // Respond to font size changes from parent
    useEffect(() => {
      const term = termRef.current;
      const fit = fitRef.current;
      if (!term || !fit || fontSize == null) return;
      term.options.fontSize = fontSize;
      try { fit.fit(); } catch { /* ignore */ }
    }, [fontSize]);

    return (
      <div
        ref={containerRef}
        className="h-full w-full p-1 sm:p-2"
      />
    );
  }
);

export default Terminal;

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

export interface TerminalHandle {
  write: (text: string) => void;
  writeln: (text: string) => void;
  clear: () => void;
  /**
   * Enter interactive execution mode.
   * While in exec mode, typed text is buffered locally and sent as stdin
   * one line at a time when Enter is pressed.  Ctrl+C triggers onKill.
   */
  enterExecMode: (onStdin: (data: string) => void, onKill: () => void) => void;
  /** Leave execution mode and return to the normal command prompt. */
  exitExecMode: () => void;
}

interface TerminalProps {
  onRunRequested?: () => void;
  fontSize?: number;
}

const PROMPT = '\x1b[38;2;86;182;194m$ \x1b[0m';

const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  function Terminal({ onRunRequested, fontSize }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const inputBuffer = useRef('');
    // Use a ref for the callback so the terminal effect doesn't re-run on every change
    const onRunRef = useRef(onRunRequested);
    useEffect(() => { onRunRef.current = onRunRequested; }, [onRunRequested]);

    // Exec mode refs — active while a Java process is running
    const execStdinCallback = useRef<((data: string) => void) | null>(null);
    const execKillCallback = useRef<(() => void) | null>(null);
    const execLineBuffer = useRef('');

    const writePrompt = useCallback(() => {
      termRef.current?.write(PROMPT);
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

      // Welcome message — compact for mobile
      const narrow = window.innerWidth < 480;
      if (narrow) {
        term.writeln('\x1b[1;36m── Collab Code ──\x1b[0m');
        term.writeln('\x1b[1;33mJava IDE Terminal\x1b[0m');
      } else {
        term.writeln('\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m');
        term.writeln('\x1b[1;36m║\x1b[0m   \x1b[1;33mCollab Code\x1b[0m — Java IDE Terminal    \x1b[1;36m║\x1b[0m');
        term.writeln('\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m');
      }
      term.writeln('');
      term.writeln('  \x1b[1;32mrun\x1b[0m   — compile & execute');
      term.writeln('  \x1b[1;32mclear\x1b[0m — clear terminal');
      term.writeln('  \x1b[1;32mreset\x1b[0m — clear data & reload');
      term.writeln('  \x1b[1;32mhelp\x1b[0m  — show commands');
      term.writeln('');
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
        if (code === 13) {
          // Enter
          term.write('\r\n');
          const cmd = inputBuffer.current.trim().toLowerCase();
          inputBuffer.current = '';

          if (cmd === 'run') {
            onRunRef.current?.();
          } else if (cmd === 'clear') {
            term.clear();
            writePrompt();
          } else if (cmd === 'reset') {
            term.writeln('\x1b[33mClearing room data...\x1b[0m');
            (async () => {
              const dbNames = await indexedDB.databases?.() ?? [];
              for (const db of dbNames) {
                if (db.name && db.name.startsWith('collab-code-')) {
                  indexedDB.deleteDatabase(db.name);
                }
              }
              term.writeln('\x1b[32mDone. Reloading...\x1b[0m');
              setTimeout(() => window.location.reload(), 500);
            })();
          } else if (cmd === 'help') {
            term.writeln('  \x1b[1;32mrun\x1b[0m   — compile & execute');
            term.writeln('  \x1b[1;32mclear\x1b[0m — clear terminal');
            term.writeln('  \x1b[1;32mreset\x1b[0m — clear data & reload');
            term.writeln('  \x1b[1;32mhelp\x1b[0m  — show commands');
            writePrompt();
          } else if (cmd) {
            term.writeln(`\x1b[31mUnknown command: ${cmd}\x1b[0m`);
            writePrompt();
          } else {
            writePrompt();
          }
        } else if (code === 127) {
          // Backspace
          if (inputBuffer.current.length > 0) {
            inputBuffer.current = inputBuffer.current.slice(0, -1);
            term.write('\b \b');
          }
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

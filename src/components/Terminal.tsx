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
}

interface TerminalProps {
  onRunRequested?: () => void;
}

const PROMPT = '\x1b[38;2;86;182;194m$ \x1b[0m';

const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  function Terminal({ onRunRequested }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const inputBuffer = useRef('');
    // Use a ref for the callback so the terminal effect doesn't re-run on every change
    const onRunRef = useRef(onRunRequested);
    useEffect(() => { onRunRef.current = onRunRequested; }, [onRunRequested]);

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
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const term = new XTerminal({
        cursorBlink: true,
        fontSize: 13,
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

      // Welcome message
      term.writeln('\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m');
      term.writeln('\x1b[1;36m║\x1b[0m   \x1b[1;33mCollab Code\x1b[0m — Java IDE Terminal   \x1b[1;36m║\x1b[0m');
      term.writeln('\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m');
      term.writeln('');
      term.writeln('  Commands:  \x1b[1;32mrun\x1b[0m     — compile & execute Java');
      term.writeln('             \x1b[1;32mclear\x1b[0m   — clear terminal');
      term.writeln('             \x1b[1;32mhelp\x1b[0m    — show this message');
      term.writeln('');
      writePrompt();

      // Handle user input
      term.onData((data) => {
        const code = data.charCodeAt(0);

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
          } else if (cmd === 'help') {
            term.writeln('  \x1b[1;32mrun\x1b[0m     — compile & execute Java');
            term.writeln('  \x1b[1;32mclear\x1b[0m   — clear terminal');
            term.writeln('  \x1b[1;32mhelp\x1b[0m    — show this message');
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

    return (
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ padding: '4px 8px' }}
      />
    );
  }
);

export default Terminal;

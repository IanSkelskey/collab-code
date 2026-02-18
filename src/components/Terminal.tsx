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
  fs?: VirtualFS;
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  function Terminal({ onRunRequested, fontSize, fs }, ref) {
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
      term.writeln('  \x1b[1;32mrun\x1b[0m    — compile & execute');
      term.writeln('  \x1b[1;32mls\x1b[0m     — list files');
      term.writeln('  \x1b[1;32mcd\x1b[0m     — change directory');
      term.writeln('  \x1b[1;32mmkdir\x1b[0m  — create directory');
      term.writeln('  \x1b[1;32mtouch\x1b[0m  — create file');
      term.writeln('  \x1b[1;32mrm\x1b[0m     — remove file or directory');
      term.writeln('  \x1b[1;32mcat\x1b[0m    — print file contents');
      term.writeln('  \x1b[1;32mpwd\x1b[0m    — print working directory');
      term.writeln('  \x1b[1;32mclear\x1b[0m  — clear terminal');
      term.writeln('  \x1b[1;32mreset\x1b[0m  — clear data & reload');
      term.writeln('  \x1b[1;32mhelp\x1b[0m   — show commands');
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
          const raw = inputBuffer.current.trim();
          inputBuffer.current = '';
          const parts = raw.split(/\s+/);
          const cmd = parts[0]?.toLowerCase() ?? '';
          const arg = parts.slice(1).join(' ');
          const vfs = fsRef.current;

          if (cmd === 'run') {
            onRunRef.current?.();
          } else if (cmd === 'clear') {
            term.clear();
            writePrompt();
          } else if (cmd === 'ls') {
            if (!vfs) {
              term.writeln('\x1b[31mFilesystem not available\x1b[0m');
            } else {
              const target = arg ? vfs.resolve(arg) : vfs.cwd;
              if (!vfs.isDirectory(target)) {
                term.writeln(`\x1b[31mls: ${arg || target}: No such directory\x1b[0m`);
              } else {
                const entries = vfs.ls(target);
                for (const entry of entries) {
                  if (entry.endsWith('/')) {
                    term.writeln(`\x1b[1;34m${entry.slice(0, -1)}/\x1b[0m`);
                  } else {
                    term.writeln(entry);
                  }
                }
                if (entries.length === 0) {
                  term.writeln('\x1b[2m(empty)\x1b[0m');
                }
              }
            }
            writePrompt();
          } else if (cmd === 'cd') {
            let newCwd: string | undefined;
            if (!vfs) {
              term.writeln('\x1b[31mFilesystem not available\x1b[0m');
            } else if (!arg || arg === '~') {
              vfs.setCwd('~');
              newCwd = '~';
            } else {
              const target = vfs.resolve(arg);
              if (vfs.isDirectory(target)) {
                vfs.setCwd(target);
                newCwd = target;
              } else {
                term.writeln(`\x1b[31mcd: ${arg}: No such directory\x1b[0m`);
              }
            }
            writePrompt(newCwd);
          } else if (cmd === 'pwd') {
            term.writeln(vfs?.cwd ?? '~');
            writePrompt();
          } else if (cmd === 'mkdir') {
            if (!vfs) {
              term.writeln('\x1b[31mFilesystem not available\x1b[0m');
            } else if (!arg) {
              term.writeln('\x1b[31mmkdir: missing operand\x1b[0m');
            } else {
              const target = vfs.resolve(arg);
              if (vfs.exists(target)) {
                term.writeln(`\x1b[31mmkdir: ${arg}: Already exists\x1b[0m`);
              } else {
                vfs.mkdir(target);
              }
            }
            writePrompt();
          } else if (cmd === 'touch') {
            if (!vfs) {
              term.writeln('\x1b[31mFilesystem not available\x1b[0m');
            } else if (!arg) {
              term.writeln('\x1b[31mtouch: missing operand\x1b[0m');
            } else {
              const target = vfs.resolve(arg);
              if (!vfs.isFile(target)) {
                vfs.writeFile(target, '');
              }
            }
            writePrompt();
          } else if (cmd === 'rm') {
            if (!vfs) {
              term.writeln('\x1b[31mFilesystem not available\x1b[0m');
            } else if (!arg) {
              term.writeln('\x1b[31mrm: missing operand\x1b[0m');
            } else {
              // Support -r / -rf flags
              const flagMatch = arg.match(/^(-\S+)\s+(.+)/);
              const flags = flagMatch ? flagMatch[1] : '';
              const targetArg = flagMatch ? flagMatch[2] : arg;
              const target = vfs.resolve(targetArg);
              const recursive = flags.includes('r');

              if (vfs.isFile(target)) {
                vfs.deleteFile(target);
              } else if (vfs.isDirectory(target)) {
                if (!recursive) {
                  term.writeln(`\x1b[31mrm: ${targetArg}: is a directory (use rm -r)\x1b[0m`);
                } else {
                  // Delete all files in directory first, then rmdir
                  const allFiles = vfs.files.filter(f => f.startsWith(target + '/'));
                  for (const f of allFiles) vfs.deleteFile(f);
                  vfs.rmdir(target);
                }
              } else {
                term.writeln(`\x1b[31mrm: ${targetArg}: No such file or directory\x1b[0m`);
              }
            }
            writePrompt();
          } else if (cmd === 'cat') {
            if (!vfs) {
              term.writeln('\x1b[31mFilesystem not available\x1b[0m');
            } else if (!arg) {
              term.writeln('\x1b[31mcat: missing operand\x1b[0m');
            } else {
              const target = vfs.resolve(arg);
              const content = vfs.readFile(target);
              if (content === null) {
                term.writeln(`\x1b[31mcat: ${arg}: No such file\x1b[0m`);
              } else {
                if (content) {
                  content.split('\n').forEach(line => term.writeln(line));
                }
              }
            }
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
            term.writeln('  \x1b[1;32mrun\x1b[0m    — compile & execute');
            term.writeln('  \x1b[1;32mls\x1b[0m     — list files');
            term.writeln('  \x1b[1;32mcd\x1b[0m     — change directory');
            term.writeln('  \x1b[1;32mmkdir\x1b[0m  — create directory');
            term.writeln('  \x1b[1;32mtouch\x1b[0m  — create file');
            term.writeln('  \x1b[1;32mrm\x1b[0m     — remove file or dir');
            term.writeln('  \x1b[1;32mcat\x1b[0m    — print file contents');
            term.writeln('  \x1b[1;32mpwd\x1b[0m    — print working directory');
            term.writeln('  \x1b[1;32mclear\x1b[0m  — clear terminal');
            term.writeln('  \x1b[1;32mreset\x1b[0m  — clear data & reload');
            term.writeln('  \x1b[1;32mhelp\x1b[0m   — show commands');
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

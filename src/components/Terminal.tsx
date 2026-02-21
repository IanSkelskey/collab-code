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
    const cursorPos = useRef(0);

    // Exec mode refs — active while a Java process is running
    const execStdinCallback = useRef<((data: string) => void) | null>(null);
    const execKillCallback = useRef<(() => void) | null>(null);
    const execLineBuffer = useRef('');
    const execCursorPos = useRef(0);

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
      term.write(`\x1b[38;2;86;182;194m~ $ \x1b[0m`);

      // Guard: prevent backspace/delete from erasing the prompt when input is empty
      term.attachCustomKeyEventHandler((e) => {
        if (execStdinCallback.current) return true; // exec mode handles its own guards
        if (e.type !== 'keydown') return true;
        if (e.key === 'Backspace' && cursorPos.current === 0 && !e.ctrlKey) return false;
        if (e.key === 'Delete' && cursorPos.current >= inputBuffer.current.length) return false;
        return true;
      });

      // ── Input helpers ──

      /** Insert text into a buffer ref at a cursor position ref and update the terminal. */
      function insertAtCursor(
        bufRef: { current: string },
        posRef: { current: number },
        text: string,
      ) {
        const before = bufRef.current;
        const pos = posRef.current;
        bufRef.current = before.slice(0, pos) + text + before.slice(pos);
        posRef.current = pos + text.length;

        if (pos === before.length) {
          // Appending at end — just write
          term.write(text);
        } else {
          // Inserting in the middle — redraw from cursor
          const tail = bufRef.current.slice(pos);
          term.write(tail);
          const backtrack = tail.length - text.length;
          if (backtrack > 0) term.write(`\x1b[${backtrack}D`);
        }
      }

      /** Replace the entire input buffer and update the terminal display. */
      function replaceLine(
        bufRef: { current: string },
        posRef: { current: number },
        newText: string,
        newPos: number,
      ) {
        const oldLen = bufRef.current.length;
        const oldCursorPos = posRef.current;
        // Move cursor to end of current text
        const toEnd = oldLen - oldCursorPos;
        if (toEnd > 0) term.write(`\x1b[${toEnd}C`);
        // Erase entire old input
        if (oldLen > 0) {
          term.write('\b'.repeat(oldLen));
          term.write(' '.repeat(oldLen));
          term.write('\b'.repeat(oldLen));
        }
        // Write new text
        bufRef.current = newText;
        posRef.current = newPos;
        term.write(newText);
        // Reposition cursor
        const back = newText.length - newPos;
        if (back > 0) term.write(`\x1b[${back}D`);
      }

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
            execCursorPos.current = 0;
            execStdinCallback.current(line);
            return;
          }
          if (code === 127) {
            // Backspace
            if (execCursorPos.current > 0) {
              const old = execLineBuffer.current;
              const pos = execCursorPos.current;
              execLineBuffer.current = old.slice(0, pos - 1) + old.slice(pos);
              execCursorPos.current = pos - 1;
              const tail = execLineBuffer.current.slice(pos - 1);
              term.write('\b' + tail + ' ' + `\x1b[${tail.length + 1}D`);
            }
            return;
          }
          // Arrow keys in exec mode
          if (data === '\x1b[D') {
            if (execCursorPos.current > 0) { execCursorPos.current--; term.write(data); }
            return;
          }
          if (data === '\x1b[C') {
            if (execCursorPos.current < execLineBuffer.current.length) { execCursorPos.current++; term.write(data); }
            return;
          }
          if (data === '\x1b[H' || data === '\x1b[1~') {
            // Home
            if (execCursorPos.current > 0) { term.write(`\x1b[${execCursorPos.current}D`); execCursorPos.current = 0; }
            return;
          }
          if (data === '\x1b[F' || data === '\x1b[4~') {
            // End
            const move = execLineBuffer.current.length - execCursorPos.current;
            if (move > 0) { term.write(`\x1b[${move}C`); execCursorPos.current = execLineBuffer.current.length; }
            return;
          }
          if (data === '\x1b[3~') {
            // Delete key — remove character after cursor
            if (execCursorPos.current < execLineBuffer.current.length) {
              const old = execLineBuffer.current;
              const pos = execCursorPos.current;
              execLineBuffer.current = old.slice(0, pos) + old.slice(pos + 1);
              const tail = execLineBuffer.current.slice(pos);
              term.write(tail + ' ' + `\x1b[${tail.length + 1}D`);
            }
            return;
          }
          if (code >= 32 && code !== 127) {
            // Printable character(s) — includes paste
            insertAtCursor(execLineBuffer, execCursorPos, data);
          }
          if (code === 22) {
            // Ctrl+V — paste from clipboard
            navigator.clipboard.readText().then(text => {
              if (text) insertAtCursor(execLineBuffer, execCursorPos, text.replace(/\r\n?/g, ''));
            }).catch(() => {});
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
              savedInput.current = inputBuffer.current;
              historyIndex.current = history.length - 1;
            } else if (historyIndex.current > 0) {
              historyIndex.current--;
            } else {
              return;
            }
          } else {
            // Down — go forward in history
            if (historyIndex.current === -1) return;
            if (historyIndex.current < history.length - 1) {
              historyIndex.current++;
            } else {
              historyIndex.current = -1;
            }
          }

          const replacement = historyIndex.current === -1
            ? savedInput.current
            : history[historyIndex.current];
          replaceLine(inputBuffer, cursorPos, replacement, replacement.length);
          return;
        }

        // Left arrow
        if (data === '\x1b[D') {
          if (cursorPos.current > 0) {
            cursorPos.current--;
            term.write(data);
          }
          return;
        }

        // Right arrow
        if (data === '\x1b[C') {
          if (cursorPos.current < inputBuffer.current.length) {
            cursorPos.current++;
            term.write(data);
          }
          return;
        }

        // Home
        if (data === '\x1b[H' || data === '\x1b[1~') {
          if (cursorPos.current > 0) {
            term.write(`\x1b[${cursorPos.current}D`);
            cursorPos.current = 0;
          }
          return;
        }

        // End
        if (data === '\x1b[F' || data === '\x1b[4~') {
          const move = inputBuffer.current.length - cursorPos.current;
          if (move > 0) {
            term.write(`\x1b[${move}C`);
            cursorPos.current = inputBuffer.current.length;
          }
          return;
        }

        // Delete key — remove character after cursor
        if (data === '\x1b[3~') {
          if (cursorPos.current < inputBuffer.current.length) {
            const old = inputBuffer.current;
            const pos = cursorPos.current;
            inputBuffer.current = old.slice(0, pos) + old.slice(pos + 1);
            const tail = inputBuffer.current.slice(pos);
            term.write(tail + ' ' + `\x1b[${tail.length + 1}D`);
          }
          return;
        }

        // Tab — file/folder name completion
        if (code === 9) {
          const vfs = fsRef.current;
          if (!vfs) return;

          const line = inputBuffer.current.slice(0, cursorPos.current);
          // Extract the token being completed (last whitespace-delimited word)
          const tokenMatch = line.match(/(\S+)$/);
          const partial = tokenMatch ? tokenMatch[1] : '';
          if (!partial) return;

          // Resolve the directory to search and the prefix to match
          const lastSlash = partial.lastIndexOf('/');
          let dirPath: string;
          let prefix: string;
          if (lastSlash >= 0) {
            dirPath = vfs.resolve(partial.slice(0, lastSlash) || '/');
            prefix = partial.slice(lastSlash + 1);
          } else {
            dirPath = vfs.cwd;
            prefix = partial;
          }

          if (!vfs.isDirectory(dirPath)) return;

          const entries = vfs.ls(dirPath);
          const matches = entries
            .map(e => e.endsWith('/') ? e.slice(0, -1) : e)
            .filter(e => e.startsWith(prefix));

          if (matches.length === 0) return;

          // Find the longest common prefix among matches
          let common = matches[0];
          for (let i = 1; i < matches.length; i++) {
            while (!matches[i].startsWith(common)) {
              common = common.slice(0, -1);
            }
          }

          const completion = common.slice(prefix.length);
          if (completion) {
            // Check if it completes to a directory — add trailing /
            const completedName = common;
            const isDir = entries.some(e => e === completedName + '/');
            const suffix = (matches.length === 1 && isDir) ? '/' : '';
            const textToInsert = completion + suffix;
            insertAtCursor(inputBuffer, cursorPos, textToInsert);
          } else if (matches.length > 1) {
            // Multiple matches, no further common prefix — show options
            term.write('\r\n');
            for (const m of matches) {
              const isDir = entries.some(e => e === m + '/');
              if (isDir) {
                term.writeln(`\x1b[1;34m${m}/\x1b[0m`);
              } else {
                term.writeln(m);
              }
            }
            writePrompt();
            term.write(inputBuffer.current);
            // Reposition cursor
            const backtrack = inputBuffer.current.length - cursorPos.current;
            if (backtrack > 0) term.write(`\x1b[${backtrack}D`);
          }
          return;
        }

        if (code === 13) {
          // Enter
          // Move cursor to end before newline
          const toEnd = inputBuffer.current.length - cursorPos.current;
          if (toEnd > 0) term.write(`\x1b[${toEnd}C`);
          term.write('\r\n');
          const raw = inputBuffer.current.trim();
          inputBuffer.current = '';
          cursorPos.current = 0;

          if (raw && raw !== commandHistory.current[commandHistory.current.length - 1]) {
            commandHistory.current.push(raw);
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
          if (cursorPos.current > 0) {
            const old = inputBuffer.current;
            const pos = cursorPos.current;
            inputBuffer.current = old.slice(0, pos - 1) + old.slice(pos);
            cursorPos.current = pos - 1;
            const tail = inputBuffer.current.slice(pos - 1);
            term.write('\b' + tail + ' ' + `\x1b[${tail.length + 1}D`);
          }
        } else if (code === 3) {
          // Ctrl+C — cancel current input
          term.write('^C\r\n');
          inputBuffer.current = '';
          cursorPos.current = 0;
          historyIndex.current = -1;
          savedInput.current = '';
          writePrompt();
        } else if (code === 22) {
          // Ctrl+V — paste from clipboard
          navigator.clipboard.readText().then(text => {
            if (text) insertAtCursor(inputBuffer, cursorPos, text.replace(/\r\n?/g, ''));
          }).catch(() => {});
        } else if (code === 27) {
          // Other escape sequences — ignore
        } else if (code >= 32) {
          // Printable chars (includes paste — data can be multiple chars)
          insertAtCursor(inputBuffer, cursorPos, data);
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

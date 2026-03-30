import type { Terminal as XTerminal } from '@xterm/xterm';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { executeCommand } from './terminalCommands';
import {
  clearBuffer,
  deleteAtCursor,
  deleteBeforeCursor,
  deleteWordBack,
  insertAtCursor,
  moveCursorEnd,
  moveCursorHome,
  moveCursorLeft,
  moveCursorRight,
  replaceLine,
  type TerminalBufferState,
} from './terminalBuffer';

type RefValue<T> = { current: T };

export interface TerminalInputRefs {
  commandBuffer: TerminalBufferState;
  execBuffer: TerminalBufferState;
  commandHistory: RefValue<string[]>;
  historyIndex: RefValue<number>;
  savedInput: RefValue<string>;
  execStdinCallback: RefValue<((data: string) => void) | null>;
  execKillCallback: RefValue<(() => void) | null>;
}

interface CreateTerminalKeyGuardOptions {
  refs: TerminalInputRefs;
}

interface CreateTerminalDataHandlerOptions {
  term: XTerminal;
  refs: TerminalInputRefs;
  getVfs: () => VirtualFS | undefined;
  getOnRun: () => (() => void) | undefined;
  getPushToast: () => ((label: string, onUndo?: () => void) => void) | undefined;
  getRequestConfirm: () => ((title: string, message: string, onConfirm: () => void) => void) | undefined;
  writePrompt: (cwdOverride?: string) => void;
}

function pasteClipboardText(term: XTerminal, buffer: TerminalBufferState) {
  void navigator.clipboard.readText().then((text) => {
    if (text) {
      insertAtCursor(term, buffer, text.replace(/\r\n?/g, ''));
    }
  }).catch(() => {});
}

function redrawPromptAndInput(
  term: XTerminal,
  writePrompt: (cwdOverride?: string) => void,
  buffer: TerminalBufferState,
): void {
  writePrompt();
  term.write(buffer.text.current);
  const backtrack = buffer.text.current.length - buffer.cursor.current;
  if (backtrack > 0) {
    term.write(`\x1b[${backtrack}D`);
  }
}

function navigateHistory(term: XTerminal, refs: TerminalInputRefs, direction: 'up' | 'down'): void {
  const history = refs.commandHistory.current;
  if (history.length === 0) return;

  if (direction === 'up') {
    if (refs.historyIndex.current === -1) {
      refs.savedInput.current = refs.commandBuffer.text.current;
      refs.historyIndex.current = history.length - 1;
    } else if (refs.historyIndex.current > 0) {
      refs.historyIndex.current -= 1;
    } else {
      return;
    }
  } else {
    if (refs.historyIndex.current === -1) return;
    if (refs.historyIndex.current < history.length - 1) {
      refs.historyIndex.current += 1;
    } else {
      refs.historyIndex.current = -1;
    }
  }

  const replacement = refs.historyIndex.current === -1
    ? refs.savedInput.current
    : history[refs.historyIndex.current];

  replaceLine(term, refs.commandBuffer, replacement, replacement.length);
}

function handleTabCompletion(
  term: XTerminal,
  refs: TerminalInputRefs,
  getVfs: () => VirtualFS | undefined,
  writePrompt: (cwdOverride?: string) => void,
): void {
  const vfs = getVfs();
  if (!vfs) return;

  const lineBeforeCursor = refs.commandBuffer.text.current.slice(0, refs.commandBuffer.cursor.current);
  const tokenMatch = lineBeforeCursor.match(/(\S+)$/);
  const partial = tokenMatch ? tokenMatch[1] : '';
  if (!partial) return;

  const lastSlash = partial.lastIndexOf('/');
  const dirPath = lastSlash >= 0
    ? vfs.resolve(partial.slice(0, lastSlash) || '/')
    : vfs.cwd;
  const prefix = lastSlash >= 0 ? partial.slice(lastSlash + 1) : partial;

  if (!vfs.isDirectory(dirPath)) return;

  const entries = vfs.ls(dirPath);
  const matches = entries
    .map((entry) => entry.endsWith('/') ? entry.slice(0, -1) : entry)
    .filter((entry) => entry.startsWith(prefix));

  if (matches.length === 0) return;

  let commonPrefix = matches[0];
  for (let i = 1; i < matches.length; i += 1) {
    while (!matches[i].startsWith(commonPrefix)) {
      commonPrefix = commonPrefix.slice(0, -1);
    }
  }

  const completion = commonPrefix.slice(prefix.length);
  if (completion) {
    const isDirectory = entries.some((entry) => entry === `${commonPrefix}/`);
    const suffix = matches.length === 1 && isDirectory ? '/' : '';
    insertAtCursor(term, refs.commandBuffer, `${completion}${suffix}`);
    return;
  }

  if (matches.length > 1) {
    term.write('\r\n');
    for (const match of matches) {
      const isDirectory = entries.some((entry) => entry === `${match}/`);
      term.writeln(isDirectory ? `\x1b[1;34m${match}/\x1b[0m` : match);
    }
    redrawPromptAndInput(term, writePrompt, refs.commandBuffer);
  }
}

function submitCommand(
  term: XTerminal,
  refs: TerminalInputRefs,
  options: Omit<CreateTerminalDataHandlerOptions, 'term' | 'refs'>,
): void {
  moveCursorEnd(term, refs.commandBuffer);
  term.write('\r\n');

  const raw = refs.commandBuffer.text.current.trim();
  clearBuffer(refs.commandBuffer);

  if (raw && raw !== refs.commandHistory.current[refs.commandHistory.current.length - 1]) {
    refs.commandHistory.current.push(raw);
    if (refs.commandHistory.current.length > 100) {
      refs.commandHistory.current.shift();
    }
  }

  refs.historyIndex.current = -1;
  refs.savedInput.current = '';

  const parts = raw.split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? '';
  const arg = parts.slice(1).join(' ');

  executeCommand(cmd, {
    term,
    arg,
    vfs: options.getVfs(),
    writePrompt: options.writePrompt,
    onRun: options.getOnRun(),
    pushToast: options.getPushToast(),
    requestConfirm: options.getRequestConfirm(),
  });
}

function handleExecModeInput(
  data: string,
  code: number,
  term: XTerminal,
  refs: TerminalInputRefs,
): boolean {
  if (!refs.execStdinCallback.current) {
    return false;
  }

  if (code === 3) {
    term.write('^C');
    refs.execKillCallback.current?.();
    return true;
  }

  if (code === 13) {
    term.write('\r\n');
    const line = `${refs.execBuffer.text.current}\n`;
    clearBuffer(refs.execBuffer);
    refs.execStdinCallback.current(line);
    return true;
  }

  if (code === 8) {
    deleteWordBack(term, refs.execBuffer);
    return true;
  }

  if (code === 127) {
    deleteBeforeCursor(term, refs.execBuffer);
    return true;
  }

  switch (data) {
    case '\x1b[D':
      moveCursorLeft(term, refs.execBuffer);
      return true;
    case '\x1b[C':
      moveCursorRight(term, refs.execBuffer);
      return true;
    case '\x1b[H':
    case '\x1b[1~':
      moveCursorHome(term, refs.execBuffer);
      return true;
    case '\x1b[F':
    case '\x1b[4~':
      moveCursorEnd(term, refs.execBuffer);
      return true;
    case '\x1b[3~':
      deleteAtCursor(term, refs.execBuffer);
      return true;
    default:
      break;
  }

  if (code === 22) {
    pasteClipboardText(term, refs.execBuffer);
    return true;
  }

  if (code >= 32 && code !== 127) {
    insertAtCursor(term, refs.execBuffer, data);
    return true;
  }

  return true;
}

function handleCommandModeInput(
  data: string,
  code: number,
  options: CreateTerminalDataHandlerOptions,
): void {
  const { term, refs, getVfs, writePrompt } = options;

  if (data === '\x1b[A') {
    navigateHistory(term, refs, 'up');
    return;
  }

  if (data === '\x1b[B') {
    navigateHistory(term, refs, 'down');
    return;
  }

  switch (data) {
    case '\x1b[D':
      moveCursorLeft(term, refs.commandBuffer);
      return;
    case '\x1b[C':
      moveCursorRight(term, refs.commandBuffer);
      return;
    case '\x1b[H':
    case '\x1b[1~':
      moveCursorHome(term, refs.commandBuffer);
      return;
    case '\x1b[F':
    case '\x1b[4~':
      moveCursorEnd(term, refs.commandBuffer);
      return;
    case '\x1b[3~':
      deleteAtCursor(term, refs.commandBuffer);
      return;
    default:
      break;
  }

  if (code === 9) {
    handleTabCompletion(term, refs, getVfs, writePrompt);
    return;
  }

  if (code === 13) {
    submitCommand(term, refs, options);
    return;
  }

  if (code === 8) {
    deleteWordBack(term, refs.commandBuffer);
    return;
  }

  if (code === 127) {
    deleteBeforeCursor(term, refs.commandBuffer);
    return;
  }

  if (code === 3) {
    term.write('^C\r\n');
    clearBuffer(refs.commandBuffer);
    refs.historyIndex.current = -1;
    refs.savedInput.current = '';
    writePrompt();
    return;
  }

  if (code === 22) {
    pasteClipboardText(term, refs.commandBuffer);
    return;
  }

  if (code === 27) {
    return;
  }

  if (code >= 32) {
    insertAtCursor(term, refs.commandBuffer, data);
  }
}

export function createTerminalKeyGuard({ refs }: CreateTerminalKeyGuardOptions) {
  return (event: KeyboardEvent) => {
    if (event.type !== 'keydown') {
      return true;
    }

    const activeBuffer = refs.execStdinCallback.current ? refs.execBuffer : refs.commandBuffer;

    if (event.key === 'Backspace' && activeBuffer.cursor.current === 0) {
      return false;
    }

    if (!refs.execStdinCallback.current && event.key === 'Delete' && activeBuffer.cursor.current >= activeBuffer.text.current.length) {
      return false;
    }

    return true;
  };
}

export function createTerminalDataHandler(options: CreateTerminalDataHandlerOptions) {
  return (data: string) => {
    const code = data.charCodeAt(0);

    if (handleExecModeInput(data, code, options.term, options.refs)) {
      return;
    }

    handleCommandModeInput(data, code, options);
  };
}


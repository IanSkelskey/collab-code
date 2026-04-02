import type * as Y from 'yjs';
import type { VirtualFS } from '../hooks/useVirtualFS';
import type { PushToast } from '../types/toast';
import { executeCommand } from './terminalCommands';
import type { TermWriter } from './terminalCommandTypes';
import {
  appendTerminalOutput,
  buildTerminalPrompt,
  clearTerminalTranscript,
  deleteAtCursor,
  deleteBeforeCursor,
  deleteWordBack,
  getActiveTerminalBuffer,
  insertTextAtCursor,
  moveCursorEnd,
  moveCursorHome,
  moveCursorLeft,
  moveCursorRight,
  pushTerminalExecEvent,
  readSharedTerminalSnapshot,
  setCommandBuffer,
  setExecBuffer,
  updateSharedTerminalState,
  type SharedTerminalSnapshot,
  type TerminalLineBuffer,
} from './sharedTerminal';

interface CreateTerminalKeyGuardOptions {
  getSnapshot: () => SharedTerminalSnapshot;
}

interface CreateTerminalDataHandlerOptions {
  ydoc: Y.Doc;
  getVfs: () => VirtualFS | undefined;
  getOnRun: () => ((filePath?: string) => void) | undefined;
  getPushToast: () => PushToast | undefined;
  getRequestConfirm: () => ((title: string, message: string, onConfirm: () => void) => void) | undefined;
}

function createSharedTermWriter(ydoc: Y.Doc): TermWriter {
  return {
    write(text) {
      appendTerminalOutput(ydoc, text);
    },
    writeln(text) {
      appendTerminalOutput(ydoc, `${text}\r\n`);
    },
    clear() {
      clearTerminalTranscript(ydoc);
    },
  };
}

function updateCommandBufferState(
  ydoc: Y.Doc,
  updater: (buffer: TerminalLineBuffer) => TerminalLineBuffer,
): void {
  updateSharedTerminalState(ydoc, (current) => {
    return setCommandBuffer(current, updater({
      text: current.commandBuffer,
      cursor: current.commandCursor,
    }));
  });
}

function updateExecBufferState(
  ydoc: Y.Doc,
  updater: (buffer: TerminalLineBuffer) => TerminalLineBuffer,
): void {
  updateSharedTerminalState(ydoc, (current) => {
    return setExecBuffer(current, updater({
      text: current.execBuffer,
      cursor: current.execCursor,
    }));
  });
}

function pasteClipboardText(ydoc: Y.Doc, mode: SharedTerminalSnapshot['mode']) {
  void navigator.clipboard.readText().then((text) => {
    const nextText = text.replace(/\r\n?/g, '');
    if (!nextText) {
      return;
    }

    if (mode === 'exec') {
      updateExecBufferState(ydoc, (buffer) => insertTextAtCursor(buffer, nextText));
      return;
    }

    updateCommandBufferState(ydoc, (buffer) => insertTextAtCursor(buffer, nextText));
  }).catch(() => {});
}

function navigateHistory(snapshot: SharedTerminalSnapshot, direction: 'up' | 'down'): SharedTerminalSnapshot {
  const history = snapshot.history;
  if (history.length === 0) {
    return snapshot;
  }

  let nextHistoryIndex = snapshot.historyIndex;
  let nextSavedInput = snapshot.savedInput;

  if (direction === 'up') {
    if (nextHistoryIndex === -1) {
      nextSavedInput = snapshot.commandBuffer;
      nextHistoryIndex = history.length - 1;
    } else if (nextHistoryIndex > 0) {
      nextHistoryIndex -= 1;
    } else {
      return snapshot;
    }
  } else {
    if (nextHistoryIndex === -1) {
      return snapshot;
    }

    if (nextHistoryIndex < history.length - 1) {
      nextHistoryIndex += 1;
    } else {
      nextHistoryIndex = -1;
    }
  }

  const replacement = nextHistoryIndex === -1
    ? nextSavedInput
    : history[nextHistoryIndex] ?? '';

  return {
    ...snapshot,
    commandBuffer: replacement,
    commandCursor: replacement.length,
    historyIndex: nextHistoryIndex,
    savedInput: nextSavedInput,
  };
}

function handleTabCompletion(
  ydoc: Y.Doc,
  snapshot: SharedTerminalSnapshot,
  getVfs: () => VirtualFS | undefined,
): void {
  const vfs = getVfs();
  if (!vfs) {
    return;
  }

  const lineBeforeCursor = snapshot.commandBuffer.slice(0, snapshot.commandCursor);
  const tokenMatch = lineBeforeCursor.match(/(\S+)$/);
  const partial = tokenMatch ? tokenMatch[1] : '';
  if (!partial) {
    return;
  }

  const lastSlash = partial.lastIndexOf('/');
  const dirPath = lastSlash >= 0
    ? vfs.resolve(partial.slice(0, lastSlash) || '/')
    : vfs.cwd;
  const prefix = lastSlash >= 0 ? partial.slice(lastSlash + 1) : partial;

  if (!vfs.isDirectory(dirPath)) {
    return;
  }

  const entries = vfs.ls(dirPath);
  const matches = entries
    .map((entry) => entry.endsWith('/') ? entry.slice(0, -1) : entry)
    .filter((entry) => entry.startsWith(prefix));

  if (matches.length === 0) {
    return;
  }

  let commonPrefix = matches[0];
  for (let index = 1; index < matches.length; index += 1) {
    while (!matches[index].startsWith(commonPrefix)) {
      commonPrefix = commonPrefix.slice(0, -1);
    }
  }

  const completion = commonPrefix.slice(prefix.length);
  if (completion) {
    const isDirectory = entries.some((entry) => entry === `${commonPrefix}/`);
    const suffix = matches.length === 1 && isDirectory ? '/' : '';
    updateCommandBufferState(ydoc, (buffer) => insertTextAtCursor(buffer, `${completion}${suffix}`));
    return;
  }

  if (matches.length > 1) {
    const listing = matches
      .map((match) => entries.some((entry) => entry === `${match}/`) ? `\x1b[1;34m${match}/\x1b[0m` : match)
      .join('\r\n');
    appendTerminalOutput(ydoc, `\r\n${listing}\r\n`);
  }
}

function submitCommand(
  ydoc: Y.Doc,
  snapshot: SharedTerminalSnapshot,
  options: Omit<CreateTerminalDataHandlerOptions, 'ydoc'>,
): void {
  const rawLine = snapshot.commandBuffer;
  const rawCommand = rawLine.trim();

  appendTerminalOutput(ydoc, `${buildTerminalPrompt(snapshot.cwd)}${rawLine}\r\n`);

  updateSharedTerminalState(ydoc, (current) => {
    const nextHistory = rawCommand
      && rawCommand !== current.history[current.history.length - 1]
      ? [...current.history, rawCommand].slice(-100)
      : current.history;

    return {
      ...current,
      commandBuffer: '',
      commandCursor: 0,
      history: nextHistory,
      historyIndex: -1,
      savedInput: '',
    };
  });

  executeCommand(rawCommand, {
    term: createSharedTermWriter(ydoc),
    vfs: options.getVfs(),
    writePrompt: () => {},
    onRun: options.getOnRun(),
    pushToast: options.getPushToast(),
    requestConfirm: options.getRequestConfirm(),
  });
}

function handleExecModeInput(
  data: string,
  code: number,
  snapshot: SharedTerminalSnapshot,
  options: CreateTerminalDataHandlerOptions,
): boolean {
  if (snapshot.mode !== 'exec') {
    return false;
  }

  if (code === 3) {
    appendTerminalOutput(options.ydoc, `${snapshot.execBuffer}^C`);
    updateSharedTerminalState(options.ydoc, (current) => ({
      ...current,
      execBuffer: '',
      execCursor: 0,
    }));

    if (snapshot.runId) {
      pushTerminalExecEvent(options.ydoc, {
        id: crypto.randomUUID(),
        runId: snapshot.runId,
        type: 'kill',
        author: options.ydoc.clientID,
      });
    }

    return true;
  }

  if (code === 13) {
    appendTerminalOutput(options.ydoc, `${snapshot.execBuffer}\r\n`);
    updateSharedTerminalState(options.ydoc, (current) => ({
      ...current,
      execBuffer: '',
      execCursor: 0,
    }));

    if (snapshot.runId) {
      pushTerminalExecEvent(options.ydoc, {
        id: crypto.randomUUID(),
        runId: snapshot.runId,
        type: 'stdin',
        data: `${snapshot.execBuffer}\n`,
        author: options.ydoc.clientID,
      });
    }

    return true;
  }

  if (code === 8) {
    updateExecBufferState(options.ydoc, deleteWordBack);
    return true;
  }

  if (code === 127) {
    updateExecBufferState(options.ydoc, deleteBeforeCursor);
    return true;
  }

  switch (data) {
    case '\x1b[D':
      updateExecBufferState(options.ydoc, moveCursorLeft);
      return true;
    case '\x1b[C':
      updateExecBufferState(options.ydoc, moveCursorRight);
      return true;
    case '\x1b[H':
    case '\x1b[1~':
      updateExecBufferState(options.ydoc, moveCursorHome);
      return true;
    case '\x1b[F':
    case '\x1b[4~':
      updateExecBufferState(options.ydoc, moveCursorEnd);
      return true;
    case '\x1b[3~':
      updateExecBufferState(options.ydoc, deleteAtCursor);
      return true;
    default:
      break;
  }

  if (code === 22) {
    pasteClipboardText(options.ydoc, 'exec');
    return true;
  }

  if (code >= 32 && code !== 127) {
    updateExecBufferState(options.ydoc, (buffer) => insertTextAtCursor(buffer, data));
    return true;
  }

  return true;
}

function handleCommandModeInput(
  data: string,
  code: number,
  snapshot: SharedTerminalSnapshot,
  options: CreateTerminalDataHandlerOptions,
): void {
  if (data === '\x1b[A') {
    updateSharedTerminalState(options.ydoc, (current) => navigateHistory(current, 'up'));
    return;
  }

  if (data === '\x1b[B') {
    updateSharedTerminalState(options.ydoc, (current) => navigateHistory(current, 'down'));
    return;
  }

  switch (data) {
    case '\x1b[D':
      updateCommandBufferState(options.ydoc, moveCursorLeft);
      return;
    case '\x1b[C':
      updateCommandBufferState(options.ydoc, moveCursorRight);
      return;
    case '\x1b[H':
    case '\x1b[1~':
      updateCommandBufferState(options.ydoc, moveCursorHome);
      return;
    case '\x1b[F':
    case '\x1b[4~':
      updateCommandBufferState(options.ydoc, moveCursorEnd);
      return;
    case '\x1b[3~':
      updateCommandBufferState(options.ydoc, deleteAtCursor);
      return;
    default:
      break;
  }

  if (code === 9) {
    handleTabCompletion(options.ydoc, snapshot, options.getVfs);
    return;
  }

  if (code === 13) {
    submitCommand(options.ydoc, snapshot, options);
    return;
  }

  if (code === 8) {
    updateCommandBufferState(options.ydoc, deleteWordBack);
    return;
  }

  if (code === 127) {
    updateCommandBufferState(options.ydoc, deleteBeforeCursor);
    return;
  }

  if (code === 3) {
    appendTerminalOutput(options.ydoc, `${buildTerminalPrompt(snapshot.cwd)}${snapshot.commandBuffer}^C\r\n`);
    updateSharedTerminalState(options.ydoc, (current) => ({
      ...current,
      commandBuffer: '',
      commandCursor: 0,
      historyIndex: -1,
      savedInput: '',
    }));
    return;
  }

  if (code === 22) {
    pasteClipboardText(options.ydoc, 'command');
    return;
  }

  if (code === 27) {
    return;
  }

  if (code >= 32) {
    updateCommandBufferState(options.ydoc, (buffer) => insertTextAtCursor(buffer, data));
  }
}

export function createTerminalKeyGuard({ getSnapshot }: CreateTerminalKeyGuardOptions) {
  return (event: KeyboardEvent) => {
    if (event.type !== 'keydown') {
      return true;
    }

    const snapshot = getSnapshot();
    const activeBuffer = getActiveTerminalBuffer(snapshot);

    if (event.key === 'Backspace' && activeBuffer.cursor === 0) {
      return false;
    }

    if (snapshot.mode !== 'exec' && event.key === 'Delete' && activeBuffer.cursor >= activeBuffer.text.length) {
      return false;
    }

    return true;
  };
}

export function createTerminalDataHandler(options: CreateTerminalDataHandlerOptions) {
  return (data: string) => {
    const snapshot = readSharedTerminalSnapshot(options.ydoc);
    if (!snapshot.initialized) {
      return;
    }

    const code = data.charCodeAt(0);

    if (handleExecModeInput(data, code, snapshot, options)) {
      return;
    }

    handleCommandModeInput(data, code, snapshot, options);
  };
}

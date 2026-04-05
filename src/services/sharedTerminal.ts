import * as Y from 'yjs';
import { printWelcome } from './terminalCommands';
import type { TermWriter } from './terminalCommandTypes';
import { ROOT_PATH, normalizeVfsPath } from '../lib/vfsPaths';

const TERMINAL_STATE_KEY = 'terminal-state';
const TERMINAL_TRANSCRIPT_KEY = 'terminal-transcript';
const TERMINAL_EXEC_EVENTS_KEY = 'terminal-exec-events';
const MAX_TRANSCRIPT_LENGTH = 120_000;

export type TerminalMode = 'command' | 'exec';

export interface SharedTerminalSnapshot {
  initialized: boolean;
  cwd: string;
  commandBuffer: string;
  commandCursor: number;
  execBuffer: string;
  execCursor: number;
  history: string[];
  historyIndex: number;
  savedInput: string;
  mode: TerminalMode;
  running: boolean;
  execOwner: number | null;
  runId: string | null;
}

export interface TerminalLineBuffer {
  text: string;
  cursor: number;
}

export interface TerminalExecEvent {
  id: string;
  runId: string;
  type: 'stdin' | 'kill';
  data?: string;
  author: number;
}

const DEFAULT_TERMINAL_STATE: SharedTerminalSnapshot = {
  initialized: false,
  cwd: ROOT_PATH,
  commandBuffer: '',
  commandCursor: 0,
  execBuffer: '',
  execCursor: 0,
  history: [],
  historyIndex: -1,
  savedInput: '',
  mode: 'command',
  running: false,
  execOwner: null,
  runId: null,
};

export function getTerminalStateMap(ydoc: Y.Doc): Y.Map<unknown> {
  return ydoc.getMap<unknown>(TERMINAL_STATE_KEY);
}

export function getTerminalTranscript(ydoc: Y.Doc): Y.Text {
  return ydoc.getText(TERMINAL_TRANSCRIPT_KEY);
}

export function getTerminalExecEvents(ydoc: Y.Doc): Y.Array<TerminalExecEvent> {
  return ydoc.getArray<TerminalExecEvent>(TERMINAL_EXEC_EVENTS_KEY);
}

export function buildTerminalPrompt(cwd: string): string {
  return `\x1b[36m${cwd} $ \x1b[0m`;
}

export function readSharedTerminalSnapshot(ydoc: Y.Doc): SharedTerminalSnapshot {
  const state = getTerminalStateMap(ydoc);

  return {
    initialized: state.get('initialized') === true,
    cwd: normalizeTerminalPath(state.get('cwd')),
    commandBuffer: readString(state.get('commandBuffer')),
    commandCursor: clampCursor(readNumber(state.get('commandCursor')), readString(state.get('commandBuffer'))),
    execBuffer: readString(state.get('execBuffer')),
    execCursor: clampCursor(readNumber(state.get('execCursor')), readString(state.get('execBuffer'))),
    history: readHistory(state.get('history')),
    historyIndex: readNumber(state.get('historyIndex'), -1),
    savedInput: readString(state.get('savedInput')),
    mode: state.get('mode') === 'exec' ? 'exec' : 'command',
    running: state.get('running') === true,
    execOwner: readNullableNumber(state.get('execOwner')),
    runId: readNullableString(state.get('runId')),
  };
}

export function ensureSharedTerminalInitialized(ydoc: Y.Doc): void {
  const state = getTerminalStateMap(ydoc);

  if (state.get('initialized') === true) {
    return;
  }

  ydoc.transact(() => {
    if (state.get('initialized') === true) {
      return;
    }

    applySharedTerminalState(state, DEFAULT_TERMINAL_STATE);

    const transcript = getTerminalTranscript(ydoc);
    if (transcript.length === 0) {
      transcript.insert(0, buildWelcomeTranscript());
    }

    state.set('initialized', true);
  });
}

export function updateSharedTerminalState(
  ydoc: Y.Doc,
  updater: (current: SharedTerminalSnapshot) => SharedTerminalSnapshot,
): SharedTerminalSnapshot {
  const state = getTerminalStateMap(ydoc);
  const current = readSharedTerminalSnapshot(ydoc);
  const next = updater(current);

  ydoc.transact(() => {
    applySharedTerminalState(state, next);
  });

  return next;
}

export function appendTerminalOutput(ydoc: Y.Doc, text: string): void {
  if (!text) {
    return;
  }

  const transcript = getTerminalTranscript(ydoc);

  ydoc.transact(() => {
    transcript.insert(transcript.length, text);
    const overflow = transcript.length - MAX_TRANSCRIPT_LENGTH;
    if (overflow > 0) {
      transcript.delete(0, overflow);
    }
  });
}

export function clearTerminalTranscript(ydoc: Y.Doc): void {
  const transcript = getTerminalTranscript(ydoc);

  if (transcript.length === 0) {
    return;
  }

  ydoc.transact(() => {
    transcript.delete(0, transcript.length);
  });
}

export function pushTerminalExecEvent(ydoc: Y.Doc, event: TerminalExecEvent): void {
  getTerminalExecEvents(ydoc).push([event]);
}

export function renderSharedTerminal(snapshot: SharedTerminalSnapshot, transcript: string): string {
  if (!snapshot.initialized && transcript.length === 0) {
    return '';
  }

  const activeBuffer = snapshot.mode === 'exec'
    ? { text: snapshot.execBuffer, cursor: snapshot.execCursor }
    : { text: snapshot.commandBuffer, cursor: snapshot.commandCursor };

  const prompt = snapshot.mode === 'command' ? buildTerminalPrompt(snapshot.cwd) : '';
  const backtrack = activeBuffer.text.length - activeBuffer.cursor;

  return `${transcript}${prompt}${activeBuffer.text}${backtrack > 0 ? `\x1b[${backtrack}D` : ''}`;
}

export function getActiveTerminalBuffer(snapshot: SharedTerminalSnapshot): TerminalLineBuffer {
  return snapshot.mode === 'exec'
    ? { text: snapshot.execBuffer, cursor: snapshot.execCursor }
    : { text: snapshot.commandBuffer, cursor: snapshot.commandCursor };
}

export function setCommandBuffer(
  snapshot: SharedTerminalSnapshot,
  buffer: TerminalLineBuffer,
): SharedTerminalSnapshot {
  return {
    ...snapshot,
    commandBuffer: buffer.text,
    commandCursor: clampCursor(buffer.cursor, buffer.text),
  };
}

export function setExecBuffer(
  snapshot: SharedTerminalSnapshot,
  buffer: TerminalLineBuffer,
): SharedTerminalSnapshot {
  return {
    ...snapshot,
    execBuffer: buffer.text,
    execCursor: clampCursor(buffer.cursor, buffer.text),
  };
}

export function insertTextAtCursor(buffer: TerminalLineBuffer, text: string): TerminalLineBuffer {
  const cursor = clampCursor(buffer.cursor, buffer.text);

  return {
    text: buffer.text.slice(0, cursor) + text + buffer.text.slice(cursor),
    cursor: cursor + text.length,
  };
}

export function deleteBeforeCursor(buffer: TerminalLineBuffer): TerminalLineBuffer {
  const cursor = clampCursor(buffer.cursor, buffer.text);
  if (cursor === 0) {
    return buffer;
  }

  return {
    text: buffer.text.slice(0, cursor - 1) + buffer.text.slice(cursor),
    cursor: cursor - 1,
  };
}

export function deleteAtCursor(buffer: TerminalLineBuffer): TerminalLineBuffer {
  const cursor = clampCursor(buffer.cursor, buffer.text);
  if (cursor >= buffer.text.length) {
    return buffer;
  }

  return {
    text: buffer.text.slice(0, cursor) + buffer.text.slice(cursor + 1),
    cursor,
  };
}

export function deleteWordBack(buffer: TerminalLineBuffer): TerminalLineBuffer {
  let cursor = clampCursor(buffer.cursor, buffer.text);
  if (cursor === 0) {
    return buffer;
  }

  while (cursor > 0 && buffer.text[cursor - 1] === ' ') {
    cursor -= 1;
  }
  while (cursor > 0 && buffer.text[cursor - 1] !== ' ') {
    cursor -= 1;
  }

  return {
    text: buffer.text.slice(0, cursor) + buffer.text.slice(buffer.cursor),
    cursor,
  };
}

export function moveCursorLeft(buffer: TerminalLineBuffer): TerminalLineBuffer {
  if (buffer.cursor === 0) {
    return buffer;
  }

  return {
    ...buffer,
    cursor: buffer.cursor - 1,
  };
}

export function moveCursorRight(buffer: TerminalLineBuffer): TerminalLineBuffer {
  if (buffer.cursor >= buffer.text.length) {
    return buffer;
  }

  return {
    ...buffer,
    cursor: buffer.cursor + 1,
  };
}

export function moveCursorHome(buffer: TerminalLineBuffer): TerminalLineBuffer {
  if (buffer.cursor === 0) {
    return buffer;
  }

  return {
    ...buffer,
    cursor: 0,
  };
}

export function moveCursorEnd(buffer: TerminalLineBuffer): TerminalLineBuffer {
  if (buffer.cursor >= buffer.text.length) {
    return buffer;
  }

  return {
    ...buffer,
    cursor: buffer.text.length,
  };
}

export function createTerminalRunId(clientId: number): string {
  return `${clientId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function applySharedTerminalState(state: Y.Map<unknown>, snapshot: SharedTerminalSnapshot): void {
  state.set('initialized', snapshot.initialized);
  state.set('cwd', normalizeTerminalPath(snapshot.cwd));
  state.set('commandBuffer', snapshot.commandBuffer);
  state.set('commandCursor', clampCursor(snapshot.commandCursor, snapshot.commandBuffer));
  state.set('execBuffer', snapshot.execBuffer);
  state.set('execCursor', clampCursor(snapshot.execCursor, snapshot.execBuffer));
  state.set('history', snapshot.history);
  state.set('historyIndex', snapshot.historyIndex);
  state.set('savedInput', snapshot.savedInput);
  state.set('mode', snapshot.mode);
  state.set('running', snapshot.running);
  state.set('execOwner', snapshot.execOwner);
  state.set('runId', snapshot.runId);
}

function buildWelcomeTranscript(): string {
  let transcript = '';
  const writer: TermWriter = {
    write(text) {
      transcript += text;
    },
    writeln(text) {
      transcript += `${text}\r\n`;
    },
    clear() {
      transcript = '';
    },
  };

  printWelcome(writer);
  return transcript;
}

function clampCursor(cursor: number, text: string): number {
  return Math.max(0, Math.min(cursor, text.length));
}

function normalizeTerminalPath(value: unknown): string {
  return typeof value === 'string' && value.trim() ? normalizeVfsPath(value) : ROOT_PATH;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readHistory(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

import type { Terminal as XTerminal } from '@xterm/xterm';

export interface TerminalBufferState {
  text: { current: string };
  cursor: { current: number };
}

export function clearBuffer(buffer: TerminalBufferState): void {
  buffer.text.current = '';
  buffer.cursor.current = 0;
}

export function deleteWordBack(term: XTerminal, buffer: TerminalBufferState): void {
  if (buffer.cursor.current === 0) return;

  let nextCursor = buffer.cursor.current;
  while (nextCursor > 0 && buffer.text.current[nextCursor - 1] === ' ') {
    nextCursor -= 1;
  }
  while (nextCursor > 0 && buffer.text.current[nextCursor - 1] !== ' ') {
    nextCursor -= 1;
  }

  const deletedLength = buffer.cursor.current - nextCursor;
  if (deletedLength === 0) return;

  buffer.text.current =
    buffer.text.current.slice(0, nextCursor) + buffer.text.current.slice(buffer.cursor.current);
  buffer.cursor.current = nextCursor;

  const tail = buffer.text.current.slice(nextCursor);
  term.write(
    '\b'.repeat(deletedLength) +
      tail +
      ' '.repeat(deletedLength) +
      `\x1b[${tail.length + deletedLength}D`,
  );
}

export function insertAtCursor(term: XTerminal, buffer: TerminalBufferState, text: string): void {
  const currentText = buffer.text.current;
  const cursorIndex = buffer.cursor.current;

  buffer.text.current = currentText.slice(0, cursorIndex) + text + currentText.slice(cursorIndex);
  buffer.cursor.current = cursorIndex + text.length;

  if (cursorIndex === currentText.length) {
    term.write(text);
    return;
  }

  const tail = buffer.text.current.slice(cursorIndex);
  term.write(tail);
  const backtrack = tail.length - text.length;
  if (backtrack > 0) {
    term.write(`\x1b[${backtrack}D`);
  }
}

export function replaceLine(
  term: XTerminal,
  buffer: TerminalBufferState,
  newText: string,
  newCursor: number,
): void {
  const oldLength = buffer.text.current.length;
  const toLineEnd = oldLength - buffer.cursor.current;
  if (toLineEnd > 0) {
    term.write(`\x1b[${toLineEnd}C`);
  }

  if (oldLength > 0) {
    term.write('\b'.repeat(oldLength));
    term.write(' '.repeat(oldLength));
    term.write('\b'.repeat(oldLength));
  }

  buffer.text.current = newText;
  buffer.cursor.current = newCursor;
  term.write(newText);

  const backtrack = newText.length - newCursor;
  if (backtrack > 0) {
    term.write(`\x1b[${backtrack}D`);
  }
}

export function deleteBeforeCursor(term: XTerminal, buffer: TerminalBufferState): void {
  if (buffer.cursor.current === 0) return;

  const currentText = buffer.text.current;
  const cursorIndex = buffer.cursor.current;

  buffer.text.current = currentText.slice(0, cursorIndex - 1) + currentText.slice(cursorIndex);
  buffer.cursor.current = cursorIndex - 1;

  const tail = buffer.text.current.slice(cursorIndex - 1);
  term.write('\b' + tail + ' ' + `\x1b[${tail.length + 1}D`);
}

export function deleteAtCursor(term: XTerminal, buffer: TerminalBufferState): void {
  if (buffer.cursor.current >= buffer.text.current.length) return;

  const currentText = buffer.text.current;
  const cursorIndex = buffer.cursor.current;

  buffer.text.current = currentText.slice(0, cursorIndex) + currentText.slice(cursorIndex + 1);

  const tail = buffer.text.current.slice(cursorIndex);
  term.write(tail + ' ' + `\x1b[${tail.length + 1}D`);
}

export function moveCursorLeft(term: XTerminal, buffer: TerminalBufferState): void {
  if (buffer.cursor.current === 0) return;
  buffer.cursor.current -= 1;
  term.write('\x1b[D');
}

export function moveCursorRight(term: XTerminal, buffer: TerminalBufferState): void {
  if (buffer.cursor.current >= buffer.text.current.length) return;
  buffer.cursor.current += 1;
  term.write('\x1b[C');
}

export function moveCursorHome(term: XTerminal, buffer: TerminalBufferState): void {
  if (buffer.cursor.current === 0) return;
  term.write(`\x1b[${buffer.cursor.current}D`);
  buffer.cursor.current = 0;
}

export function moveCursorEnd(term: XTerminal, buffer: TerminalBufferState): void {
  const moveDistance = buffer.text.current.length - buffer.cursor.current;
  if (moveDistance <= 0) return;
  term.write(`\x1b[${moveDistance}C`);
  buffer.cursor.current = buffer.text.current.length;
}

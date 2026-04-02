import type { TermWriter } from './terminalCommandTypes';

const ANSI_RESET = '\x1b[0m';

function wrapAnsi(code: string, text: string): string {
  return `${code}${text}${ANSI_RESET}`;
}

export function formatHelpEntry(name: string, help: string): string {
  const pad = ' '.repeat(Math.max(1, 7 - name.length));
  return `  ${wrapAnsi('\x1b[1;32m', name)}${pad}- ${help}`;
}

export function writeError(term: TermWriter, message: string): void {
  term.writeln(wrapAnsi('\x1b[31m', message));
}

export function writeSuccess(term: TermWriter, message: string): void {
  term.writeln(wrapAnsi('\x1b[32m', message));
}

export function writeWarning(term: TermWriter, message: string): void {
  term.writeln(wrapAnsi('\x1b[33m', message));
}

export function writeMuted(term: TermWriter, message: string): void {
  term.writeln(wrapAnsi('\x1b[2m', message));
}

export function writeDirectoryEntry(term: TermWriter, entry: string): void {
  if (entry.endsWith('/')) {
    term.writeln(wrapAnsi('\x1b[1;34m', entry));
    return;
  }

  term.writeln(entry);
}

export function writeDirectoryListing(term: TermWriter, entries: string[]): void {
  if (entries.length === 0) {
    writeMuted(term, '(empty)');
    return;
  }

  for (const entry of entries) {
    writeDirectoryEntry(term, entry);
  }
}

export function printWelcomeBanner(term: TermWriter): void {
  const narrow = window.innerWidth < 480;
  const termLabel = 'Collaborative Terminal';

  if (narrow) {
    term.writeln(wrapAnsi('\x1b[1;36m', '-- Collab Code --'));
    term.writeln(wrapAnsi('\x1b[1;33m', termLabel));
    return;
  }

  const innerText = `   Collab Code - ${termLabel}`;
  const boxWidth = Math.max(38, innerText.length + 4);
  const rightPad = ' '.repeat(boxWidth - innerText.length);

  term.writeln(wrapAnsi('\x1b[1;36m', `+${'-'.repeat(boxWidth)}+`));
  term.writeln(`\x1b[1;36m|\x1b[0m   \x1b[1;33mCollab Code\x1b[0m - ${termLabel}${rightPad}\x1b[1;36m|\x1b[0m`);
  term.writeln(wrapAnsi('\x1b[1;36m', `+${'-'.repeat(boxWidth)}+`));
}

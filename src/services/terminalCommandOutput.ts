import type { TermWriter } from './terminalCommandTypes';

const ANSI_RESET = '\x1b[0m';
const ANSI_ACCENT = '\x1b[1;36m';
const ANSI_COMMAND = '\x1b[1;32m';

function wrapAnsi(code: string, text: string): string {
  return `${code}${text}${ANSI_RESET}`;
}

function formatCommand(name: string): string {
  return wrapAnsi(ANSI_COMMAND, name);
}

export function formatHelpEntry(name: string, help: string): string {
  const pad = ' '.repeat(Math.max(1, 7 - name.length));
  return `  ${formatCommand(name)}${pad}- ${help}`;
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
  term.writeln(wrapAnsi(ANSI_ACCENT, 'Collab Code terminal ready.'));
  term.writeln(`Type ${formatCommand('help')} to see all commands. Use ${formatCommand('clear')} to reset the terminal.`);
  term.writeln(
    `Try ${formatCommand('run')}, ${formatCommand('ls')}, ${formatCommand('cd')}, ${formatCommand('pwd')}, or ${formatCommand('cat <file>')}.`,
  );
}

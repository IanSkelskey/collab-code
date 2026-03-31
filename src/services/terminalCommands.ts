import { parseTerminalCommand } from './terminalCommandParser';
import {
  formatHelpEntry,
  printWelcomeBanner,
  writeError,
  writeSuccess,
  writeWarning,
} from './terminalCommandOutput';
import { fsCommandEntries } from './terminalFsCommands';
import type { CommandContext, CommandDef, TermWriter } from './terminalCommandTypes';

type CommandExecutionContext = Omit<CommandContext, 'command'>;

const commandEntries: Array<[string, CommandDef]> = [
  ['run', {
    help: 'compile & execute',
    run(ctx) {
      ctx.onRun?.();
    },
  }],
  ['clear', {
    help: 'clear terminal',
    run(ctx) {
      ctx.term.clear();
      ctx.writePrompt();
    },
  }],
  ['pwd', {
    help: 'print working directory',
    run(ctx) {
      ctx.term.writeln(ctx.vfs?.cwd ?? '~');
      ctx.writePrompt();
    },
  }],
  ...fsCommandEntries,
  ['reset', {
    help: 'clear data & reload',
    run(ctx) {
      writeWarning(ctx.term, 'Clearing room data...');
      void (async () => {
        const dbNames = await indexedDB.databases?.() ?? [];
        for (const db of dbNames) {
          if (db.name && db.name.startsWith('collab-code-')) {
            indexedDB.deleteDatabase(db.name);
          }
        }

        writeSuccess(ctx.term, 'Done. Reloading...');
        setTimeout(() => window.location.reload(), 500);
      })();
    },
  }],
  ['help', {
    help: 'show commands',
    run(ctx) {
      printHelp(ctx.term);
      ctx.writePrompt();
    },
  }],
];

const commands = new Map(commandEntries);

export type { CommandContext, TermWriter } from './terminalCommandTypes';

export function executeCommand(input: string, ctx: CommandExecutionContext): void {
  const command = parseTerminalCommand(input);
  const def = commands.get(command.name);

  if (def) {
    def.run({ ...ctx, command });
    return;
  }

  if (command.name) {
    writeError(ctx.term, `Unknown command: ${command.name}`);
    ctx.writePrompt();
    return;
  }

  ctx.writePrompt();
}

export function printHelp(term: TermWriter): void {
  for (const [name, def] of commandEntries) {
    term.writeln(formatHelpEntry(name, def.help));
  }
}

export function printWelcome(term: TermWriter): void {
  printWelcomeBanner(term);
  term.writeln('');
  printHelp(term);
  term.writeln('');
}

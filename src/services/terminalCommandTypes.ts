import type { VirtualFS } from '../hooks/useVirtualFS';
import type { PushToast } from '../types/toast';

export interface TermWriter {
  write(text: string): void;
  writeln(text: string): void;
  clear(): void;
}

export interface ParsedTerminalCommand {
  name: string;
  args: string[];
  raw: string;
  rawArgs: string;
}

export interface CommandContext {
  term: TermWriter;
  command: ParsedTerminalCommand;
  vfs: VirtualFS | undefined;
  writePrompt: (cwdOverride?: string) => void;
  onRun: (() => void) | undefined;
  pushToast: PushToast | undefined;
  requestConfirm: ((title: string, message: string, onConfirm: () => void) => void) | undefined;
}

export interface CommandDef {
  help: string;
  run(ctx: CommandContext): void;
}

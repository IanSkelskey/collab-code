import type { ParsedTerminalCommand } from './terminalCommandTypes';

type QuoteChar = '"' | "'";

function isQuoteChar(value: string): value is QuoteChar {
  return value === '"' || value === "'";
}

export function parseTerminalCommand(rawInput: string): ParsedTerminalCommand {
  const input = rawInput.trim();
  const tokens: string[] = [];
  let current = '';
  let quote: QuoteChar | null = null;
  let escaping = false;

  for (const character of input) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (character === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (isQuoteChar(character)) {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += character;
  }

  if (escaping) {
    current += '\\';
  }

  if (current) {
    tokens.push(current);
  }

  const [nameToken = '', ...args] = tokens;

  return {
    name: nameToken.toLowerCase(),
    args,
    raw: input,
    rawArgs: nameToken ? input.slice(nameToken.length).trim() : '',
  };
}

export function getSingleCommandArg(command: ParsedTerminalCommand): string {
  if (command.args.length === 0) {
    return '';
  }

  return command.args.length === 1 ? command.args[0] : command.rawArgs;
}

export function getPairCommandArgs(command: ParsedTerminalCommand): [string, string] | null {
  if (command.args.length < 2) {
    return null;
  }

  const [sourceArg, ...destinationParts] = command.args;
  return [sourceArg, destinationParts.join(' ')];
}

import type { VirtualFS } from '../hooks/useVirtualFS';
import { primaryLanguage } from '../config/languages';
import { deleteFileWithUndo, deleteDirWithConfirm, validateFileName } from './fileOps';

// ── Types ──

/** Minimal write interface the commands need from xterm. */
export interface TermWriter {
  write(text: string): void;
  writeln(text: string): void;
  clear(): void;
}

export interface CommandContext {
  term: TermWriter;
  arg: string;
  vfs: VirtualFS | undefined;
  writePrompt: (cwdOverride?: string) => void;
  onRun: (() => void) | undefined;
  pushToast: ((label: string, onUndo: () => void) => void) | undefined;
  requestConfirm: ((title: string, message: string, onConfirm: () => void) => void) | undefined;
}

interface CommandDef {
  /** Short description shown in help output. */
  help: string;
  run(ctx: CommandContext): void;
}

// ── Helpers ──

function requireVfs(ctx: CommandContext): VirtualFS | null {
  if (!ctx.vfs) {
    ctx.term.writeln('\x1b[31mFilesystem not available\x1b[0m');
    return null;
  }
  return ctx.vfs;
}

// ── Command definitions ──

const commands: Record<string, CommandDef> = {
  run: {
    help: 'compile & execute',
    run(ctx) {
      ctx.onRun?.();
    },
  },

  clear: {
    help: 'clear terminal',
    run(ctx) {
      ctx.term.clear();
      ctx.writePrompt();
    },
  },

  ls: {
    help: 'list files',
    run(ctx) {
      const vfs = requireVfs(ctx);
      if (!vfs) { ctx.writePrompt(); return; }

      const target = ctx.arg ? vfs.resolve(ctx.arg) : vfs.cwd;
      if (!vfs.isDirectory(target)) {
        ctx.term.writeln(`\x1b[31mls: ${ctx.arg || target}: No such directory\x1b[0m`);
      } else {
        const entries = vfs.ls(target);
        for (const entry of entries) {
          if (entry.endsWith('/')) {
            ctx.term.writeln(`\x1b[1;34m${entry.slice(0, -1)}/\x1b[0m`);
          } else {
            ctx.term.writeln(entry);
          }
        }
        if (entries.length === 0) {
          ctx.term.writeln('\x1b[2m(empty)\x1b[0m');
        }
      }
      ctx.writePrompt();
    },
  },

  cd: {
    help: 'change directory',
    run(ctx) {
      const vfs = requireVfs(ctx);
      let newCwd: string | undefined;
      if (!vfs) {
        // already printed error
      } else if (!ctx.arg || ctx.arg === '~') {
        vfs.setCwd('~');
        newCwd = '~';
      } else {
        const target = vfs.resolve(ctx.arg);
        if (vfs.isDirectory(target)) {
          vfs.setCwd(target);
          newCwd = target;
        } else {
          ctx.term.writeln(`\x1b[31mcd: ${ctx.arg}: No such directory\x1b[0m`);
        }
      }
      ctx.writePrompt(newCwd);
    },
  },

  pwd: {
    help: 'print working directory',
    run(ctx) {
      ctx.term.writeln(ctx.vfs?.cwd ?? '~');
      ctx.writePrompt();
    },
  },

  mkdir: {
    help: 'create directory',
    run(ctx) {
      const vfs = requireVfs(ctx);
      if (!vfs) { ctx.writePrompt(); return; }

      if (!ctx.arg) {
        ctx.term.writeln('\x1b[31mmkdir: missing operand\x1b[0m');
      } else {
        const target = vfs.resolve(ctx.arg);
        const name = target.split('/').pop()!;
        const nameError = validateFileName(name);
        if (nameError) {
          ctx.term.writeln(`\x1b[31mmkdir: ${ctx.arg}: ${nameError}\x1b[0m`);
        } else if (vfs.exists(target)) {
          ctx.term.writeln(`\x1b[31mmkdir: ${ctx.arg}: Already exists\x1b[0m`);
        } else {
          vfs.mkdir(target);
        }
      }
      ctx.writePrompt();
    },
  },

  touch: {
    help: 'create file',
    run(ctx) {
      const vfs = requireVfs(ctx);
      if (!vfs) { ctx.writePrompt(); return; }

      if (!ctx.arg) {
        ctx.term.writeln('\x1b[31mtouch: missing operand\x1b[0m');
      } else {
        const target = vfs.resolve(ctx.arg);
        const name = target.split('/').pop()!;
        const nameError = validateFileName(name);
        if (nameError) {
          ctx.term.writeln(`\x1b[31mtouch: ${ctx.arg}: ${nameError}\x1b[0m`);
        } else if (vfs.isFile(target)) {
          ctx.term.writeln(`\x1b[31mtouch: ${ctx.arg}: File already exists\x1b[0m`);
        } else {
          vfs.writeFile(target, '');
        }
      }
      ctx.writePrompt();
    },
  },

  rm: {
    help: 'remove file or dir',
    run(ctx) {
      const vfs = requireVfs(ctx);
      if (!vfs) { ctx.writePrompt(); return; }

      if (!ctx.arg) {
        ctx.term.writeln('\x1b[31mrm: missing operand\x1b[0m');
        ctx.writePrompt();
        return;
      }

      // Support -r / -rf flags
      const flagMatch = ctx.arg.match(/^(-\S+)\s+(.+)/);
      const flags = flagMatch ? flagMatch[1] : '';
      const targetArg = flagMatch ? flagMatch[2] : ctx.arg;
      const target = vfs.resolve(targetArg);
      const recursive = flags.includes('r');

      if (vfs.isFile(target)) {
        deleteFileWithUndo(vfs, target, ctx.pushToast);
      } else if (vfs.isDirectory(target)) {
        if (!recursive) {
          ctx.term.writeln(`\x1b[31mrm: ${targetArg}: is a directory (use rm -r)\x1b[0m`);
        } else {
          deleteDirWithConfirm(vfs, target, ctx.pushToast, ctx.requestConfirm);
        }
      } else {
        ctx.term.writeln(`\x1b[31mrm: ${targetArg}: No such file or directory\x1b[0m`);
      }
      ctx.writePrompt();
    },
  },

  mv: {
    help: 'move / rename',
    run(ctx) {
      const vfs = requireVfs(ctx);
      if (!vfs) { ctx.writePrompt(); return; }

      const mvParts = ctx.arg.split(/\s+/);
      if (mvParts.length < 2) {
        ctx.term.writeln('\x1b[31mmv: usage: mv <source> <dest>\x1b[0m');
      } else {
        const src = vfs.resolve(mvParts[0]);
        const dest = vfs.resolve(mvParts.slice(1).join(' '));

        if (!vfs.exists(src)) {
          ctx.term.writeln(`\x1b[31mmv: ${mvParts[0]}: No such file or directory\x1b[0m`);
        } else if (src === '~') {
          ctx.term.writeln('\x1b[31mmv: cannot move root directory\x1b[0m');
        } else if (vfs.isDirectory(dest)) {
          const name = src.split('/').pop()!;
          const newPath = dest + '/' + name;
          if (vfs.exists(newPath)) {
            ctx.term.writeln(`\x1b[31mmv: ${newPath.split('/').pop()}: already exists in target\x1b[0m`);
          } else {
            vfs.rename(src, newPath);
          }
        } else {
          const destParent = dest.split('/').slice(0, -1).join('/') || '~';
          if (!vfs.isDirectory(destParent)) {
            ctx.term.writeln(`\x1b[31mmv: ${mvParts.slice(1).join(' ')}: No such directory\x1b[0m`);
          } else if (vfs.exists(dest)) {
            ctx.term.writeln(`\x1b[31mmv: ${mvParts.slice(1).join(' ')}: Already exists\x1b[0m`);
          } else {
            vfs.rename(src, dest);
          }
        }
      }
      ctx.writePrompt();
    },
  },

  cp: {
    help: 'copy file',
    run(ctx) {
      const vfs = requireVfs(ctx);
      if (!vfs) { ctx.writePrompt(); return; }

      const parts = ctx.arg.split(/\s+/);
      if (parts.length < 2) {
        ctx.term.writeln('\x1b[31mcp: usage: cp <source> <dest>\x1b[0m');
      } else {
        const src = vfs.resolve(parts[0]);
        const dest = vfs.resolve(parts.slice(1).join(' '));

        if (!vfs.isFile(src)) {
          ctx.term.writeln(`\x1b[31mcp: ${parts[0]}: No such file\x1b[0m`);
        } else if (vfs.isDirectory(dest)) {
          const name = src.split('/').pop()!;
          const newPath = dest + '/' + name;
          if (vfs.exists(newPath)) {
            ctx.term.writeln(`\x1b[31mcp: ${name}: already exists in target\x1b[0m`);
          } else {
            const content = vfs.readFile(src) ?? '';
            vfs.writeFile(newPath, content);
          }
        } else {
          if (vfs.exists(dest)) {
            ctx.term.writeln(`\x1b[31mcp: ${parts.slice(1).join(' ')}: Already exists\x1b[0m`);
          } else {
            const destParent = dest.split('/').slice(0, -1).join('/') || '~';
            if (!vfs.isDirectory(destParent)) {
              ctx.term.writeln(`\x1b[31mcp: ${parts.slice(1).join(' ')}: No such directory\x1b[0m`);
            } else {
              const content = vfs.readFile(src) ?? '';
              vfs.writeFile(dest, content);
            }
          }
        }
      }
      ctx.writePrompt();
    },
  },

  cat: {
    help: 'print file contents',
    run(ctx) {
      const vfs = requireVfs(ctx);
      if (!vfs) { ctx.writePrompt(); return; }

      if (!ctx.arg) {
        ctx.term.writeln('\x1b[31mcat: missing operand\x1b[0m');
      } else {
        const target = vfs.resolve(ctx.arg);
        const content = vfs.readFile(target);
        if (content === null) {
          ctx.term.writeln(`\x1b[31mcat: ${ctx.arg}: No such file\x1b[0m`);
        } else if (content) {
          content.split('\n').forEach(line => ctx.term.writeln(line));
        }
      }
      ctx.writePrompt();
    },
  },

  reset: {
    help: 'clear data & reload',
    run(ctx) {
      ctx.term.writeln('\x1b[33mClearing room data...\x1b[0m');
      (async () => {
        const dbNames = await indexedDB.databases?.() ?? [];
        for (const db of dbNames) {
          if (db.name && db.name.startsWith('collab-code-')) {
            indexedDB.deleteDatabase(db.name);
          }
        }
        ctx.term.writeln('\x1b[32mDone. Reloading...\x1b[0m');
        setTimeout(() => window.location.reload(), 500);
      })();
    },
  },

  help: {
    help: 'show commands',
    run(ctx) {
      printHelp(ctx.term);
      ctx.writePrompt();
    },
  },
};

// ── Public API ──

/** Execute a parsed command string. */
export function executeCommand(cmd: string, ctx: CommandContext): void {
  const def = commands[cmd];
  if (def) {
    def.run(ctx);
  } else if (cmd) {
    ctx.term.writeln(`\x1b[31mUnknown command: ${cmd}\x1b[0m`);
    ctx.writePrompt();
  } else {
    ctx.writePrompt();
  }
}

/** Print the help / command list. */
export function printHelp(term: TermWriter): void {
  for (const [name, def] of Object.entries(commands)) {
    const pad = ' '.repeat(Math.max(1, 7 - name.length));
    term.writeln(`  \x1b[1;32m${name}\x1b[0m${pad}— ${def.help}`);
  }
}

/** Print the welcome banner + help. */
export function printWelcome(term: TermWriter): void {
  const narrow = window.innerWidth < 480;
  if (narrow) {
    term.writeln('\x1b[1;36m── Collab Code ──\x1b[0m');
    term.writeln(`\x1b[1;33m${primaryLanguage.label} IDE Terminal\x1b[0m`);
  } else {
    const termLabel = `${primaryLanguage.label} IDE Terminal`;
    const innerText = `   Collab Code — ${termLabel}`;
    const boxWidth = Math.max(38, innerText.length + 4);
    const rightPad = ' '.repeat(boxWidth - innerText.length);
    term.writeln(`\x1b[1;36m╔${'═'.repeat(boxWidth)}╗\x1b[0m`);
    term.writeln(`\x1b[1;36m║\x1b[0m   \x1b[1;33mCollab Code\x1b[0m — ${termLabel}${rightPad}\x1b[1;36m║\x1b[0m`);
    term.writeln(`\x1b[1;36m╚${'═'.repeat(boxWidth)}╝\x1b[0m`);
  }
  term.writeln('');
  printHelp(term);
  term.writeln('');
}

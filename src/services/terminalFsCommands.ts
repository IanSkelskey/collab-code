import type { VirtualFS } from '../hooks/useVirtualFS';
import { getBaseName, getParentPath, isRootPath, joinVfsPath } from '../lib/vfsPaths';
import { deleteDirWithConfirm, deleteFileWithUndo, validateFileName } from './fileOps';
import { getPairCommandArgs, getSingleCommandArg } from './terminalCommandParser';
import { writeDirectoryListing, writeError } from './terminalCommandOutput';
import type { CommandContext, CommandDef } from './terminalCommandTypes';

type FsCommandAction = (ctx: CommandContext, vfs: VirtualFS) => string | void;

function createFsCommand(help: string, action: FsCommandAction): CommandDef {
  return {
    help,
    run(ctx) {
      if (!ctx.vfs) {
        writeError(ctx.term, 'Filesystem not available');
        ctx.writePrompt();
        return;
      }

      const cwdOverride = action(ctx, ctx.vfs) ?? undefined;
      ctx.writePrompt(cwdOverride);
    },
  };
}

function validateTargetName(arg: string, targetPath: string): string | null {
  const nameError = validateFileName(getBaseName(targetPath));
  return nameError ? `${arg}: ${nameError}` : null;
}

function resolveDestinationPath(
  vfs: VirtualFS,
  sourcePath: string,
  destinationArg: string,
): { destinationPath: string } | { error: string } {
  const destinationPath = vfs.resolve(destinationArg);

  if (vfs.isDirectory(destinationPath)) {
    const nestedPath = joinVfsPath(destinationPath, getBaseName(sourcePath));
    if (vfs.exists(nestedPath)) {
      return { error: `${getBaseName(nestedPath)}: already exists in target` };
    }

    return { destinationPath: nestedPath };
  }

  const destinationParent = getParentPath(destinationPath);
  if (!vfs.isDirectory(destinationParent)) {
    return { error: `${destinationArg}: No such directory` };
  }

  if (vfs.exists(destinationPath)) {
    return { error: `${destinationArg}: Already exists` };
  }

  return { destinationPath };
}

export const fsCommandEntries: Array<[string, CommandDef]> = [
  ['ls', createFsCommand('list files', (ctx, vfs) => {
    const targetArg = getSingleCommandArg(ctx.command);
    const targetPath = targetArg ? vfs.resolve(targetArg) : vfs.cwd;

    if (!vfs.isDirectory(targetPath)) {
      writeError(ctx.term, `ls: ${targetArg || targetPath}: No such directory`);
      return;
    }

    writeDirectoryListing(ctx.term, vfs.ls(targetPath));
  })],
  ['cd', createFsCommand('change directory', (ctx, vfs) => {
    const targetArg = getSingleCommandArg(ctx.command);

    if (!targetArg || targetArg === '~') {
      vfs.setCwd('~');
      return '~';
    }

    const targetPath = vfs.resolve(targetArg);
    if (!vfs.isDirectory(targetPath)) {
      writeError(ctx.term, `cd: ${targetArg}: No such directory`);
      return;
    }

    vfs.setCwd(targetPath);
    return targetPath;
  })],
  ['mkdir', createFsCommand('create directory', (ctx, vfs) => {
    const targetArg = getSingleCommandArg(ctx.command);
    if (!targetArg) {
      writeError(ctx.term, 'mkdir: missing operand');
      return;
    }

    const targetPath = vfs.resolve(targetArg);
    const nameError = validateTargetName(targetArg, targetPath);
    if (nameError) {
      writeError(ctx.term, `mkdir: ${nameError}`);
      return;
    }

    if (vfs.exists(targetPath)) {
      writeError(ctx.term, `mkdir: ${targetArg}: Already exists`);
      return;
    }

    vfs.mkdir(targetPath);
  })],
  ['touch', createFsCommand('create file', (ctx, vfs) => {
    const targetArg = getSingleCommandArg(ctx.command);
    if (!targetArg) {
      writeError(ctx.term, 'touch: missing operand');
      return;
    }

    const targetPath = vfs.resolve(targetArg);
    const nameError = validateTargetName(targetArg, targetPath);
    if (nameError) {
      writeError(ctx.term, `touch: ${nameError}`);
      return;
    }

    if (vfs.isFile(targetPath)) {
      writeError(ctx.term, `touch: ${targetArg}: File already exists`);
      return;
    }

    vfs.writeFile(targetPath, '');
  })],
  ['rm', createFsCommand('remove file or dir', (ctx, vfs) => {
    if (ctx.command.args.length === 0) {
      writeError(ctx.term, 'rm: missing operand');
      return;
    }

    const [firstArg, ...restArgs] = ctx.command.args;
    const hasFlags = firstArg.startsWith('-');
    const flags = hasFlags ? firstArg : '';
    const targetArg = hasFlags ? restArgs.join(' ') : getSingleCommandArg(ctx.command);
    if (!targetArg) {
      writeError(ctx.term, 'rm: missing operand');
      return;
    }

    const targetPath = vfs.resolve(targetArg);
    const recursive = flags.includes('r');

    if (vfs.isFile(targetPath)) {
      deleteFileWithUndo(vfs, targetPath, ctx.pushToast);
      return;
    }

    if (vfs.isDirectory(targetPath)) {
      if (!recursive) {
        writeError(ctx.term, `rm: ${targetArg}: is a directory (use rm -r)`);
        return;
      }

      deleteDirWithConfirm(vfs, targetPath, ctx.pushToast, ctx.requestConfirm);
      return;
    }

    writeError(ctx.term, `rm: ${targetArg}: No such file or directory`);
  })],
  ['mv', createFsCommand('move / rename', (ctx, vfs) => {
    const pairArgs = getPairCommandArgs(ctx.command);
    if (!pairArgs) {
      writeError(ctx.term, 'mv: usage: mv <source> <dest>');
      return;
    }

    const [sourceArg, destinationArg] = pairArgs;
    const sourcePath = vfs.resolve(sourceArg);
    if (!vfs.exists(sourcePath)) {
      writeError(ctx.term, `mv: ${sourceArg}: No such file or directory`);
      return;
    }

    if (isRootPath(sourcePath)) {
      writeError(ctx.term, 'mv: cannot move root directory');
      return;
    }

    const resolvedDestination = resolveDestinationPath(vfs, sourcePath, destinationArg);
    if ('error' in resolvedDestination) {
      writeError(ctx.term, `mv: ${resolvedDestination.error}`);
      return;
    }

    vfs.rename(sourcePath, resolvedDestination.destinationPath);
  })],
  ['cp', createFsCommand('copy file', (ctx, vfs) => {
    const pairArgs = getPairCommandArgs(ctx.command);
    if (!pairArgs) {
      writeError(ctx.term, 'cp: usage: cp <source> <dest>');
      return;
    }

    const [sourceArg, destinationArg] = pairArgs;
    const sourcePath = vfs.resolve(sourceArg);
    if (!vfs.isFile(sourcePath)) {
      writeError(ctx.term, `cp: ${sourceArg}: No such file`);
      return;
    }

    const resolvedDestination = resolveDestinationPath(vfs, sourcePath, destinationArg);
    if ('error' in resolvedDestination) {
      writeError(ctx.term, `cp: ${resolvedDestination.error}`);
      return;
    }

    const content = vfs.readFile(sourcePath) ?? '';
    vfs.writeFile(resolvedDestination.destinationPath, content);
  })],
  ['cat', createFsCommand('print file contents', (ctx, vfs) => {
    const targetArg = getSingleCommandArg(ctx.command);
    if (!targetArg) {
      writeError(ctx.term, 'cat: missing operand');
      return;
    }

    const targetPath = vfs.resolve(targetArg);
    const content = vfs.readFile(targetPath);
    if (content === null) {
      writeError(ctx.term, `cat: ${targetArg}: No such file`);
      return;
    }

    if (!content) {
      return;
    }

    content.split('\n').forEach((line) => ctx.term.writeln(line));
  })],
];

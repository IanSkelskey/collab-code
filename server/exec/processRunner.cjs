const { spawn } = require('child_process');
const { collectSyncedFiles } = require('./workspace.cjs');

const EXEC_TIMEOUT_MS = 30000;

function runProcess(context) {
  const {
    command,
    args,
    cwd,
    files,
    ignoredDirs,
    ignoredExtensions,
    send,
    cleanup,
    setActiveProcess,
    setTimeoutHandle,
    ws,
    runtimeLabel,
  } = context;

  const child = spawn(command, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  setActiveProcess(child);

  setTimeoutHandle(setTimeout(() => {
    if (child.exitCode === null && !child.killed) {
      send({ type: 'stderr', data: '\n[Execution timed out after 30 seconds]\n' });
      child.kill('SIGKILL');
    }
  }, EXEC_TIMEOUT_MS));

  child.stdout.on('data', (data) => {
    send({ type: 'stdout', data: data.toString() });
  });

  child.stderr.on('data', (data) => {
    send({ type: 'stderr', data: data.toString() });
  });

  child.on('close', (exitCode) => {
    console.log(`[exec] ${runtimeLabel} process exited with code ${exitCode}`);

    try {
      const syncFiles = collectSyncedFiles(cwd, files, ignoredDirs, ignoredExtensions);
      if (Object.keys(syncFiles).length > 0) {
        console.log(`[exec] Syncing ${Object.keys(syncFiles).length} file(s) back to client`);
        send({ type: 'files-sync', files: syncFiles });
      }
    } catch (err) {
      send({ type: 'stderr', data: `\n[File sync scan failed: ${err.message}]\n` });
    }

    send({ type: 'exit', code: exitCode ?? 1 });
    cleanup();

    try { ws.close(); } catch {}
  });

  child.on('error', (err) => {
    send({ type: 'error', data: `Failed to start ${runtimeLabel}: ${err.message}` });
    cleanup();
  });
}

module.exports = {
  runProcess,
};

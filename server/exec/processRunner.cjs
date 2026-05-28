const { spawn } = require('child_process');
const { collectSyncedFiles } = require('./workspace.cjs');

function runProcess(context) {
  const {
    command,
    args,
    cwd,
    spawnOptions,
    files,
    ignoredDirs,
    ignoredExtensions,
    send,
    cleanup,
    setActiveProcess,
    refreshInactivityTimeout = () => {},
    ws,
    runtimeLabel,
    getFailureHint,
  } = context;

  let stderrTail = '';
  const STDERR_TAIL_LIMIT = 64 * 1024;

  const child = spawn(command, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...spawnOptions,
  });
  setActiveProcess(child);

  refreshInactivityTimeout();

  child.stdout.on('data', (data) => {
    refreshInactivityTimeout();
    send({ type: 'stdout', data: data.toString() });
  });

  child.stderr.on('data', (data) => {
    refreshInactivityTimeout();
    const text = data.toString();
    stderrTail = (stderrTail + text).slice(-STDERR_TAIL_LIMIT);
    send({ type: 'stderr', data: text });
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

    if (exitCode !== 0 && typeof getFailureHint === 'function') {
      try {
        const hint = getFailureHint(stderrTail);
        if (hint) {
          send({ type: 'stderr', data: hint });
        }
      } catch {}
    }

    send({ type: 'exit', code: exitCode ?? 1 });
    cleanup();

    try {
      ws.close();
    } catch {}
  });

  child.on('error', (err) => {
    send({ type: 'error', data: `Failed to start ${runtimeLabel}: ${err.message}` });
    cleanup();
  });
}

module.exports = {
  runProcess,
};

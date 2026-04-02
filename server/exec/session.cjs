const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { runProcess } = require('./processRunner.cjs');
const { getRunner, resolveExecutionLanguage } = require('./runtimeRegistry.cjs');
const {
  getExecutionSandboxStatus,
  getExecutionSpawnOptions,
  isExecutionAllowed,
  prepareExecutionWorkspace,
} = require('./sandbox.cjs');
const {
  sanitizeRelativePath,
  normalizeProjectFiles,
  writeProjectFiles,
} = require('./workspace.cjs');

function handleExecConnection(ws) {
  let activeProcess = null;
  let tmpDir = null;
  let timeout = null;

  function send(obj) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function cleanup() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (activeProcess) {
      try { activeProcess.kill('SIGKILL'); } catch {}
      activeProcess = null;
    }
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      tmpDir = null;
    }
  }

  function beginExecution(message) {
    if (activeProcess || tmpDir) {
      send({ type: 'error', data: 'An execution is already in progress' });
      return;
    }

    if (!isExecutionAllowed()) {
      send({ type: 'error', data: getExecutionSandboxStatus() });
      return;
    }

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-exec-'));
    const files = normalizeProjectFiles(message);
    const language = resolveExecutionLanguage(message, files);

    if (!language) {
      send({ type: 'error', data: 'No runnable Java or Python files found in project' });
      cleanup();
      return;
    }

    const runner = getRunner(language);
    if (!runner) {
      send({ type: 'error', data: `Unsupported execution language: ${language}` });
      cleanup();
      return;
    }

    writeProjectFiles(tmpDir, files);
    try {
      prepareExecutionWorkspace(tmpDir);
    } catch (err) {
      send({ type: 'error', data: `Failed to prepare execution sandbox: ${err.message}` });
      cleanup();
      return;
    }

    const execSpawnOptions = getExecutionSpawnOptions(tmpDir);
    runner.start({
      files,
      entryPoint: sanitizeRelativePath(message.entryPoint || message.mainClass || ''),
      tmpDir,
      execSpawnOptions,
      runProcess,
      send,
      cleanup,
      setActiveProcess(process) {
        activeProcess = process;
      },
      setTimeoutHandle(handle) {
        timeout = handle;
      },
      ws,
    });
  }

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (message.type === 'exec') {
      beginExecution(message);
      return;
    }

    if (message.type === 'stdin') {
      if (activeProcess && activeProcess.stdin.writable) {
        activeProcess.stdin.write(message.data);
      }
      return;
    }

    if (message.type === 'kill' && activeProcess) {
      console.log('[exec] Kill requested');
      activeProcess.kill('SIGKILL');
    }
  });

  ws.on('close', () => {
    console.log('[exec] Client disconnected');
    cleanup();
  });

  ws.on('error', () => {
    cleanup();
  });
}

module.exports = {
  handleExecConnection,
};

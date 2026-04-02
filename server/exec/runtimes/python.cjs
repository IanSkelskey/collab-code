const { spawnSync } = require('child_process');
const path = require('path');
const { findFilesByExtension } = require('../workspace.cjs');

const PYTHON_RUNTIME_CANDIDATES = [
  { command: 'python3', args: [] },
  { command: 'python', args: [] },
  { command: 'py', args: ['-3'] },
];

const pythonRuntime = detectPythonRuntime();

function detectPythonRuntime() {
  for (const candidate of PYTHON_RUNTIME_CANDIDATES) {
    try {
      const versionCheck = spawnSync(candidate.command, [...candidate.args, '--version'], { encoding: 'utf8' });
      if (versionCheck.status !== 0) {
        continue;
      }

      const versionOutput = `${versionCheck.stdout || versionCheck.stderr || ''}`.trim();
      const version = versionOutput.split(/\r?\n/, 1)[0] || null;
      console.log(`[exec] Python runtime "${candidate.command}" is available - interactive execution enabled`);
      return {
        available: true,
        version,
        command: candidate.command,
        args: candidate.args,
      };
    } catch {}
  }

  console.log('[exec] Python runtime NOT found - interactive Python execution disabled');
  return {
    available: false,
    version: null,
    command: null,
    args: [],
  };
}

const pythonRunner = {
  language: 'python',
  isAvailable() {
    return pythonRuntime.available;
  },
  getVersion() {
    return pythonRuntime.version;
  },
  canHandle({ files }) {
    return findFilesByExtension(files, '.py').length > 0;
  },
  start(context) {
    const {
      files,
      entryPoint,
      tmpDir,
      execSpawnOptions,
      runProcess,
      send,
      cleanup,
      setActiveProcess,
      setTimeoutHandle,
      ws,
    } = context;

    if (!pythonRuntime.available || !pythonRuntime.command) {
      send({ type: 'error', data: 'Python is not available on this server' });
      cleanup();
      return;
    }

    const pythonFiles = findFilesByExtension(files, '.py');
    if (pythonFiles.length === 0) {
      send({ type: 'error', data: 'No .py files found in project' });
      cleanup();
      return;
    }

    let resolvedEntryPoint = entryPoint;
    if (resolvedEntryPoint) {
      if (!files[resolvedEntryPoint] || !resolvedEntryPoint.endsWith('.py')) {
        send({ type: 'error', data: `Python entry point not found: ${resolvedEntryPoint}` });
        cleanup();
        return;
      }
    } else {
      [resolvedEntryPoint] = pythonFiles;
    }

    const runtimeEntryPoint = resolvedEntryPoint.split('/').join(path.sep);
    console.log(`[exec] Running Python file ${resolvedEntryPoint} in ${tmpDir}`);
    send({ type: 'compile-start' });
    send({ type: 'compile-ok' });

    runProcess({
      command: pythonRuntime.command,
      args: [...pythonRuntime.args, '-I', '-B', runtimeEntryPoint],
      cwd: tmpDir,
      spawnOptions: execSpawnOptions,
      files,
      ignoredDirs: new Set(['__pycache__']),
      ignoredExtensions: new Set(['.pyc']),
      send,
      cleanup,
      setActiveProcess,
      setTimeoutHandle,
      ws,
      runtimeLabel: 'Python',
    });
  },
};

module.exports = {
  pythonRunner,
};

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const { findFilesByExtension } = require('../workspace.cjs');

const PYTHON_RUNTIME_CANDIDATES = [
  { command: 'python3', args: [] },
  { command: 'python', args: [] },
  { command: 'py', args: ['-3'] },
];
const PYTHON_SETUP_TIMEOUT_MS = 120000;
const PYTHON_VENV_DIRNAME = '.__collab_exec_venv__';
const REQUIREMENTS_FILENAME = 'requirements.txt';
const SOCKET_OPEN = 1;

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

      const venvCheck = spawnSync(candidate.command, [...candidate.args, '-m', 'venv', '--help'], {
        encoding: 'utf8',
      });
      if (venvCheck.status !== 0) {
        console.warn(
          `[exec] Python runtime "${candidate.command}" found, but virtual environments are unavailable - interactive execution disabled`,
        );
        continue;
      }

      console.log(
        `[exec] Python runtime "${candidate.command}" with virtual environment support is available - interactive execution enabled`,
      );
      return {
        available: true,
        version,
        command: candidate.command,
        args: candidate.args,
      };
    } catch {}
  }

  console.log('[exec] Python runtime not found, or virtual environments are unavailable - interactive Python execution disabled');
  return {
    available: false,
    version: null,
    command: null,
    args: [],
  };
}

function getVenvDirectory(tmpDir) {
  return path.join(tmpDir, PYTHON_VENV_DIRNAME);
}

function getVenvBinDirectory(venvDir) {
  return process.platform === 'win32'
    ? path.join(venvDir, 'Scripts')
    : path.join(venvDir, 'bin');
}

function getVenvPythonCommand(venvDir) {
  return process.platform === 'win32'
    ? path.join(getVenvBinDirectory(venvDir), 'python.exe')
    : path.join(getVenvBinDirectory(venvDir), 'python');
}

function getPathEnvKey(env) {
  return Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
}

function buildVenvSpawnOptions(execSpawnOptions, venvDir) {
  const baseEnv = execSpawnOptions?.env || process.env;
  const pathKey = getPathEnvKey(baseEnv);
  const currentPath = baseEnv[pathKey] || '';
  const venvBin = getVenvBinDirectory(venvDir);

  return {
    ...execSpawnOptions,
    env: {
      ...baseEnv,
      [pathKey]: currentPath ? `${venvBin}${path.delimiter}${currentPath}` : venvBin,
      VIRTUAL_ENV: venvDir,
      PIP_REQUIRE_VIRTUALENV: '1',
      PIP_NO_INPUT: '1',
      PIP_DISABLE_PIP_VERSION_CHECK: '1',
      PYTHONDONTWRITEBYTECODE: '1',
    },
  };
}

function resolveRequirementsFile(entryPoint, files) {
  let currentDir = path.posix.dirname(entryPoint);

  while (true) {
    const candidate = currentDir === '.' ? REQUIREMENTS_FILENAME : `${currentDir}/${REQUIREMENTS_FILENAME}`;
    const content = files[candidate];
    if (typeof content === 'string') {
      return {
        relativePath: candidate,
        hasPackages: content.trim().length > 0,
      };
    }

    if (!currentDir || currentDir === '.') {
      return null;
    }

    const parentDir = path.posix.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

function getRequirementsInstallDirectory(tmpDir, relativePath) {
  const requirementsDir = path.posix.dirname(relativePath);
  return requirementsDir === '.' ? tmpDir : path.join(tmpDir, requirementsDir);
}

function formatSetupFailure(stepLabel, reason, output) {
  const detail = output.trim();
  return detail
    ? `${stepLabel} failed: ${reason}\n\n${detail}`
    : `${stepLabel} failed: ${reason}`;
}

function runBufferedCommand({
  command,
  args,
  cwd,
  spawnOptions,
  timeoutMs,
  stepLabel,
  setActiveProcess,
  setTimeoutHandle,
}) {
  return new Promise((resolve, reject) => {
    let output = '';
    let finished = false;
    let timedOut = false;

    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...spawnOptions,
    });
    setActiveProcess(child);

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    setTimeoutHandle(timeoutHandle);

    const settle = (settler, value) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutHandle);
      setTimeoutHandle(null);
      setActiveProcess(null);
      settler(value);
    };

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code, signal) => {
      if (timedOut) {
        settle(reject, new Error(formatSetupFailure(
          stepLabel,
          `timed out after ${Math.round(timeoutMs / 1000)} seconds`,
          output,
        )));
        return;
      }

      if (signal) {
        settle(reject, new Error(formatSetupFailure(stepLabel, `terminated by ${signal}`, output)));
        return;
      }

      if (code !== 0) {
        settle(reject, new Error(formatSetupFailure(stepLabel, `exited with code ${code}`, output)));
        return;
      }

      settle(resolve, output);
    });

    child.on('error', (err) => {
      settle(reject, new Error(formatSetupFailure(stepLabel, err.message, output)));
    });
  });
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
      send({ type: 'error', data: 'Python virtual environments are not available on this server' });
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
    const requirementsFile = resolveRequirementsFile(resolvedEntryPoint, files);
    const venvDir = getVenvDirectory(tmpDir);
    const venvPythonCommand = getVenvPythonCommand(venvDir);
    const venvSpawnOptions = buildVenvSpawnOptions(execSpawnOptions, venvDir);

    console.log(`[exec] Running Python file ${resolvedEntryPoint} in ${tmpDir}`);
    send({ type: 'compile-start' });

    void (async () => {
      try {
        send({ type: 'stdout', data: '[Creating isolated Python virtual environment]\n' });
        await runBufferedCommand({
          command: pythonRuntime.command,
          args: [...pythonRuntime.args, '-m', 'venv', PYTHON_VENV_DIRNAME],
          cwd: tmpDir,
          spawnOptions: execSpawnOptions,
          timeoutMs: PYTHON_SETUP_TIMEOUT_MS,
          stepLabel: 'Python environment setup',
          setActiveProcess,
          setTimeoutHandle,
        });

        if (ws.readyState !== SOCKET_OPEN) {
          cleanup();
          return;
        }

        if (requirementsFile?.hasPackages) {
          console.log(`[exec] Installing Python packages from ${requirementsFile.relativePath}`);
          send({
            type: 'stdout',
            data: `[Installing Python packages from ${requirementsFile.relativePath}]\n`,
          });

          await runBufferedCommand({
            command: venvPythonCommand,
            args: [
              '-m',
              'pip',
              'install',
              '--disable-pip-version-check',
              '--no-cache-dir',
              '-r',
              path.join(tmpDir, requirementsFile.relativePath.split('/').join(path.sep)),
            ],
            cwd: getRequirementsInstallDirectory(tmpDir, requirementsFile.relativePath),
            spawnOptions: venvSpawnOptions,
            timeoutMs: PYTHON_SETUP_TIMEOUT_MS,
            stepLabel: `Python package install (${requirementsFile.relativePath})`,
            setActiveProcess,
            setTimeoutHandle,
          });
        }

        if (ws.readyState !== SOCKET_OPEN) {
          cleanup();
          return;
        }

        send({ type: 'compile-ok' });
        runProcess({
          command: venvPythonCommand,
          args: ['-I', '-B', runtimeEntryPoint],
          cwd: tmpDir,
          spawnOptions: venvSpawnOptions,
          files,
          ignoredDirs: new Set(['__pycache__', PYTHON_VENV_DIRNAME]),
          ignoredExtensions: new Set(['.pyc']),
          send,
          cleanup,
          setActiveProcess,
          setTimeoutHandle,
          ws,
          runtimeLabel: 'Python',
        });
      } catch (err) {
        send({ type: 'compile-error', data: err instanceof Error ? err.message : String(err) });
        cleanup();
      }
    })();
  },
};

module.exports = {
  pythonRunner,
};

const fs = require('fs');
const path = require('path');

function parseOptionalInteger(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readBooleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function detectExecutionSandbox() {
  const sandboxRequired = readBooleanEnv('EXEC_REQUIRE_SANDBOX', false);
  const allowUnsandboxedRoot = readBooleanEnv('EXEC_ALLOW_UNSANDBOXED_ROOT', false);

  if (process.platform === 'win32' || typeof process.getuid !== 'function') {
    return {
      enabled: false,
      allowed: !sandboxRequired,
      uid: null,
      gid: null,
      reason: 'POSIX uid/gid privilege dropping is unavailable on this platform',
    };
  }

  if (process.getuid() !== 0) {
    return {
      enabled: false,
      allowed: !sandboxRequired,
      uid: null,
      gid: null,
      reason: 'Server is not running as root, so execution cannot be dropped to a separate OS user',
    };
  }

  const uid = parseOptionalInteger(process.env.EXEC_SANDBOX_UID);
  const gid = parseOptionalInteger(process.env.EXEC_SANDBOX_GID);
  if (uid == null || gid == null) {
    const allowed = sandboxRequired ? false : allowUnsandboxedRoot;
    return {
      enabled: false,
      allowed,
      uid: null,
      gid: null,
      reason: allowed
        ? 'Server is running as root without a dedicated execution user'
        : 'Server is running as root without a dedicated execution user. Configure EXEC_SANDBOX_UID and EXEC_SANDBOX_GID, or set EXEC_ALLOW_UNSANDBOXED_ROOT=1 to override',
    };
  }

  return {
    enabled: true,
    allowed: true,
    uid,
    gid,
    reason: `Execution runs as uid ${uid}, gid ${gid}`,
  };
}

const executionSandbox = detectExecutionSandbox();

if (executionSandbox.enabled) {
  console.log(`[exec] Sandbox enabled - ${executionSandbox.reason}`);
} else if (executionSandbox.allowed) {
  console.warn(`[exec] WARNING: execution is not sandboxed - ${executionSandbox.reason}`);
} else {
  console.error(`[exec] Execution disabled - ${executionSandbox.reason}`);
}

function applyOwnership(targetPath, uid, gid) {
  const stats = fs.lstatSync(targetPath);
  if (stats.isSymbolicLink()) {
    return;
  }

  fs.chownSync(targetPath, uid, gid);
  if (stats.isDirectory()) {
    fs.chmodSync(targetPath, 0o700);
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      applyOwnership(path.join(targetPath, entry.name), uid, gid);
    }
    return;
  }

  fs.chmodSync(targetPath, 0o600);
}

function prepareExecutionWorkspace(tmpDir) {
  if (!executionSandbox.enabled) {
    return;
  }

  applyOwnership(tmpDir, executionSandbox.uid, executionSandbox.gid);
}

function buildExecutionEnv(tmpDir) {
  if (process.platform === 'win32') {
    return {
      ...process.env,
      HOME: tmpDir,
      USERPROFILE: tmpDir,
      TMPDIR: tmpDir,
      TEMP: tmpDir,
      TMP: tmpDir,
    };
  }

  const env = {
    PATH: process.env.PATH || '',
    HOME: tmpDir,
    TMPDIR: tmpDir,
    TEMP: tmpDir,
    TMP: tmpDir,
    LANG: process.env.LANG || 'C.UTF-8',
    LC_ALL: process.env.LC_ALL || process.env.LANG || 'C.UTF-8',
  };

  if (process.env.JAVA_HOME) {
    env.JAVA_HOME = process.env.JAVA_HOME;
  }

  return env;
}

function getExecutionSpawnOptions(tmpDir) {
  const spawnOptions = {
    env: buildExecutionEnv(tmpDir),
    windowsHide: true,
  };

  if (executionSandbox.enabled) {
    spawnOptions.uid = executionSandbox.uid;
    spawnOptions.gid = executionSandbox.gid;
  }

  return spawnOptions;
}

function isExecutionAllowed() {
  return executionSandbox.allowed;
}

function isExecutionSandboxed() {
  return executionSandbox.enabled;
}

function getExecutionSandboxStatus() {
  if (executionSandbox.enabled) {
    return `Sandboxed - ${executionSandbox.reason}`;
  }

  if (!executionSandbox.allowed) {
    return `Disabled - ${executionSandbox.reason}`;
  }

  return `Unsandboxed - ${executionSandbox.reason}`;
}

module.exports = {
  getExecutionSpawnOptions,
  getExecutionSandboxStatus,
  isExecutionAllowed,
  isExecutionSandboxed,
  prepareExecutionWorkspace,
};

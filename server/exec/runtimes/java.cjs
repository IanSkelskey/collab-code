const { spawn, spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findFilesByExtension } = require('../workspace.cjs');

const javaRuntime = detectJavaRuntime();

function detectJavaRuntime() {
  try {
    execSync('javac -version', { stdio: 'ignore' });
    const versionCheck = spawnSync('java', ['-version'], { encoding: 'utf8' });
    const versionOutput = `${versionCheck.stderr || versionCheck.stdout || ''}`.trim();
    const version = versionCheck.status === 0
      ? versionOutput.split(/\r?\n/, 1)[0] || null
      : null;

    console.log('[exec] Java compiler (javac) is available - interactive execution enabled');
    return { available: true, version };
  } catch {
    console.log('[exec] Java compiler (javac) NOT found - interactive Java execution disabled');
    return { available: false, version: null };
  }
}

function buildSourceByClass(files) {
  const sourceByClass = {};

  for (const [relativePath, content] of Object.entries(files)) {
    if (!relativePath.endsWith('.java')) {
      continue;
    }

    const className = path.basename(relativePath, '.java');
    sourceByClass[className] = content;
  }

  return sourceByClass;
}

function resolveMainClass(sourceByClass, className) {
  const source = sourceByClass[className];
  if (!source) {
    return className;
  }

  const packageMatch = source.match(/^\s*package\s+([\w.]+)\s*;/m);
  return packageMatch ? `${packageMatch[1]}.${className}` : className;
}

const javaRunner = {
  language: 'java',
  isAvailable() {
    return javaRuntime.available;
  },
  getVersion() {
    return javaRuntime.version;
  },
  canHandle({ files }) {
    return findFilesByExtension(files, '.java').length > 0;
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

    if (!javaRuntime.available) {
      send({ type: 'error', data: 'Java is not available on this server' });
      cleanup();
      return;
    }

    const javaFiles = findFilesByExtension(files, '.java').map((relativePath) => path.join(tmpDir, relativePath));
    if (javaFiles.length === 0) {
      send({ type: 'error', data: 'No .java files found in project' });
      cleanup();
      return;
    }

    const sourceByClass = buildSourceByClass(files);
    const mainClass = resolveMainClass(sourceByClass, entryPoint || 'Main');
    const outDir = path.join(tmpDir, '__out__');
    fs.mkdirSync(outDir, { recursive: true });
    if (typeof execSpawnOptions?.uid === 'number' && typeof execSpawnOptions?.gid === 'number') {
      fs.chownSync(outDir, execSpawnOptions.uid, execSpawnOptions.gid);
      fs.chmodSync(outDir, 0o700);
    }

    console.log(`[exec] Compiling ${javaFiles.length} Java file(s) in ${tmpDir}, main class: ${mainClass}`);
    send({ type: 'compile-start' });

    const javac = spawn('javac', ['-d', outDir, ...javaFiles], {
      cwd: tmpDir,
      ...execSpawnOptions,
    });
    let compileErr = '';

    javac.stderr.on('data', (data) => {
      compileErr += data.toString();
    });

    javac.on('close', (code) => {
      if (code !== 0) {
        console.log('[exec] Java compilation failed');
        send({ type: 'compile-error', data: compileErr });
        cleanup();
        return;
      }

      console.log(`[exec] Java compilation succeeded, running ${mainClass}`);
      send({ type: 'compile-ok' });
      runProcess({
        command: 'java',
        args: [`-Djava.io.tmpdir=${tmpDir}`, `-Duser.home=${tmpDir}`, '-cp', outDir, mainClass],
        cwd: tmpDir,
        spawnOptions: execSpawnOptions,
        files,
        ignoredDirs: new Set(['__out__']),
        ignoredExtensions: new Set(['.class']),
        send,
        cleanup,
        setActiveProcess,
        setTimeoutHandle,
        ws,
        runtimeLabel: 'Java',
      });
    });

    javac.on('error', (err) => {
      send({ type: 'error', data: `Failed to start javac: ${err.message}` });
      cleanup();
    });
  },
};

module.exports = {
  javaRunner,
};

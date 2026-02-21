/**
 * Interactive Java execution over WebSocket.
 *
 * Protocol (JSON messages):
 *   Client → Server:
 *     { type: "exec", source_code: "...", files?: {...}, mainClass?: "..." }
 *     { type: "stdin", data: "..." }
 *     { type: "kill" }
 *
 *   Server → Client:
 *     { type: "compile-start" }
 *     { type: "compile-error", data: "..." }
 *     { type: "compile-ok" }
 *     { type: "stdout", data: "..." }
 *     { type: "stderr", data: "..." }
 *     { type: "exit", code: N }
 *     { type: "error", data: "..." }
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const EXEC_TIMEOUT_MS = 30000; // 30 seconds

// ---------------------------------------------------------------------------
//  Check if Java is available on this server
// ---------------------------------------------------------------------------
let javaAvailable = false;
try {
  execSync('javac -version', { stdio: 'ignore' });
  javaAvailable = true;
  console.log('[exec] Java compiler (javac) is available — interactive execution enabled');
} catch {
  console.log('[exec] Java compiler (javac) NOT found — interactive execution disabled');
}

function isJavaAvailable() {
  return javaAvailable;
}

// ---------------------------------------------------------------------------
//  Handle one interactive execution session
// ---------------------------------------------------------------------------
function handleExecConnection(ws) {
  let javaProcess = null;
  let tmpDir = null;
  let timeout = null;

  function send(obj) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function cleanup() {
    if (timeout) { clearTimeout(timeout); timeout = null; }
    if (javaProcess) {
      try { javaProcess.kill('SIGKILL'); } catch {}
      javaProcess = null;
    }
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      tmpDir = null;
    }
  }

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'exec') {
      // Prevent multiple simultaneous executions
      if (javaProcess || tmpDir) {
        send({ type: 'error', data: 'An execution is already in progress' });
        return;
      }

      if (!javaAvailable) {
        send({ type: 'error', data: 'Java is not available on this server' });
        return;
      }

      // Create temp directory and write all source files
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-exec-'));

      // Support both old { source_code } and new { files } protocol
      const files = msg.files || { 'Main.java': msg.source_code };
      const requestedMainClass = msg.mainClass || null;
      const javaFiles = [];
      const sourceByClass = {};

      for (const [relPath, content] of Object.entries(files)) {
        // Security: prevent path traversal
        const safePath = relPath.replace(/\.\./g, '').replace(/^\//, '');
        const fullPath = path.join(tmpDir, safePath);
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content);
        if (safePath.endsWith('.java')) {
          javaFiles.push(fullPath);
          const className = path.basename(safePath, '.java');
          sourceByClass[className] = content;
        }
      }

      if (javaFiles.length === 0) {
        send({ type: 'error', data: 'No .java files found in project' });
        cleanup();
        return;
      }

      function resolveMainClass(className) {
        const src = sourceByClass[className];
        if (!src) return className;
        const pkgMatch = src.match(/^\s*package\s+([\w.]+)\s*;/m);
        return pkgMatch ? pkgMatch[1] + '.' + className : className;
      }

      const mainClass = resolveMainClass(requestedMainClass || 'Main');

      console.log(`[exec] Compiling ${javaFiles.length} file(s) in ${tmpDir}, main class: ${mainClass}`);
      send({ type: 'compile-start' });

      const outDir = path.join(tmpDir, '__out__');
      fs.mkdirSync(outDir, { recursive: true });

      // --- Compile ---
      const javac = spawn('javac', ['-d', outDir, ...javaFiles]);
      let compileErr = '';

      javac.stderr.on('data', (data) => {
        compileErr += data.toString();
      });

      javac.on('close', (code) => {
        if (code !== 0) {
          console.log(`[exec] Compilation failed`);
          send({ type: 'compile-error', data: compileErr });
          cleanup();
          return;
        }

        console.log(`[exec] Compilation succeeded, running ${mainClass}`);
        send({ type: 'compile-ok' });

        // --- Run ---
        javaProcess = spawn('java', ['-cp', outDir, mainClass], {
          cwd: tmpDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        timeout = setTimeout(() => {
          if (javaProcess) {
            send({ type: 'stderr', data: '\n[Execution timed out after 30 seconds]\n' });
            javaProcess.kill('SIGKILL');
          }
        }, EXEC_TIMEOUT_MS);

        javaProcess.stdout.on('data', (data) => {
          send({ type: 'stdout', data: data.toString() });
        });

        javaProcess.stderr.on('data', (data) => {
          send({ type: 'stderr', data: data.toString() });
        });

        javaProcess.on('close', (exitCode) => {
          console.log(`[exec] Process exited with code ${exitCode}`);

          // Scan temp dir for files created/modified by the Java program
          try {
            const syncFiles = {};
            const scanDir = (dir, rel) => {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                const relPath = rel ? rel + '/' + entry.name : entry.name;
                if (entry.isDirectory()) {
                  if (entry.name === '__out__') continue;
                  scanDir(fullPath, relPath);
                } else if (!entry.name.endsWith('.class')) {
                  const stat = fs.statSync(fullPath);
                  if (stat.size > 1024 * 256) continue;
                  const buf = fs.readFileSync(fullPath);
                  if (buf.includes(0)) continue;
                  const content = buf.toString('utf-8');
                  const original = files[relPath];
                  if (original === undefined || original !== content) {
                    syncFiles[relPath] = content;
                  }
                }
              }
            };
            scanDir(tmpDir, '');

            if (Object.keys(syncFiles).length > 0) {
              console.log(`[exec] Syncing ${Object.keys(syncFiles).length} file(s) back to client`);
              send({ type: 'files-sync', files: syncFiles });
            }
          } catch (err) {
            console.log(`[exec] File sync scan failed: ${err.message}`);
          }

          send({ type: 'exit', code: exitCode ?? 1 });
          javaProcess = null;
          cleanup();

          try { ws.close(); } catch {}
        });

        javaProcess.on('error', (err) => {
          send({ type: 'error', data: `Failed to start Java: ${err.message}` });
          javaProcess = null;
          cleanup();
        });
      });

      javac.on('error', (err) => {
        send({ type: 'error', data: `Failed to start javac: ${err.message}` });
        cleanup();
      });

    } else if (msg.type === 'stdin') {
      if (javaProcess && javaProcess.stdin.writable) {
        javaProcess.stdin.write(msg.data);
      }
    } else if (msg.type === 'kill') {
      if (javaProcess) {
        console.log(`[exec] Kill requested`);
        javaProcess.kill('SIGKILL');
      }
    }
  });

  ws.on('close', () => {
    console.log(`[exec] Client disconnected`);
    cleanup();
  });

  ws.on('error', () => {
    cleanup();
  });
}

module.exports = { handleExecConnection, isJavaAvailable };

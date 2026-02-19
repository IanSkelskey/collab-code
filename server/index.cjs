/**
 * Lightweight Yjs WebSocket + interactive Java execution server for Collab Code.
 *
 * - Relays Yjs document updates and awareness between clients via WebSocket
 * - Proxies batch code execution to Judge0 CE (fallback, /execute endpoint)
 * - Runs Java interactively on the server with streaming stdin/stdout/stderr
 *   via a dedicated WebSocket endpoint (/exec)
 *
 * Usage:
 *   node server/index.cjs              # default port 4444
 *   PORT=8080 node server/index.cjs    # custom port
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = parseInt(process.env.PORT || '4444', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Judge0 CE public instance — free, no API key required (fallback).
const JUDGE0_HOST = process.env.JUDGE0_HOST || 'ce.judge0.com';
const LANGUAGE_IDS = {
  java: 91,
  python: 92,
  javascript: 97,
  c: 75,
  cpp: 76,
};

// Execution limits
const EXEC_TIMEOUT_MS = 30000;   // 30 seconds

// ---------------------------------------------------------------------------
//  Check if Java is available on this server
// ---------------------------------------------------------------------------
let javaAvailable = false;
try {
  execSync('javac -version', { stdio: 'ignore' });
  javaAvailable = true;
  console.log('[exec] Java compiler (javac) is available — interactive execution enabled');
} catch {
  console.log('[exec] Java compiler (javac) NOT found — interactive execution disabled, using Judge0 fallback');
}

// ---------------------------------------------------------------------------
//  Interactive Java execution over WebSocket (/exec)
// ---------------------------------------------------------------------------
/**
 * Handle one interactive execution session.
 *
 * Protocol (JSON messages):
 *   Client → Server:
 *     { type: "exec", source_code: "..." }  — start execution
 *     { type: "stdin", data: "..." }         — send stdin to running process
 *     { type: "kill" }                       — kill running process
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
      const requestedMainClass = msg.mainClass || null; // e.g. "App" (from App.java)
      const javaFiles = [];
      /** Map from simple class name → source content for package detection */
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

      // Determine the fully-qualified main class name.
      // If the client specified a class, look up its package declaration.
      // Otherwise fall back to "Main" for backwards compatibility.
      function resolveMainClass(className) {
        const src = sourceByClass[className];
        if (!src) return className;
        const pkgMatch = src.match(/^\s*package\s+([\w.]+)\s*;/m);
        return pkgMatch ? pkgMatch[1] + '.' + className : className;
      }

      const mainClass = resolveMainClass(requestedMainClass || 'Main');

      console.log(`[exec] Compiling ${javaFiles.length} file(s) in ${tmpDir}, main class: ${mainClass}`);
      send({ type: 'compile-start' });

      // Separate output directory for compiled .class files.
      // Using -d ensures classes are placed according to their package
      // declaration, not their source directory — so dir/Two.java with
      // no package produces __out__/Two.class (not __out__/dir/Two.class).
      const outDir = path.join(tmpDir, '__out__');
      fs.mkdirSync(outDir, { recursive: true });

      // --- Compile all Java files into __out__ ---
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

        // --- Run from __out__, with cwd = tmpDir so file I/O is relative to project root ---
        javaProcess = spawn('java', ['-cp', outDir, mainClass], {
          cwd: tmpDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Timeout guard
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
          // and sync them back to the client's virtual filesystem.
          try {
            const syncFiles = {};
            const scanDir = (dir, rel) => {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, entry.name);
                const relPath = rel ? rel + '/' + entry.name : entry.name;
                if (entry.isDirectory()) {
                  // Skip the __out__ build directory
                  if (entry.name === '__out__') continue;
                  scanDir(fullPath, relPath);
                } else if (!entry.name.endsWith('.class')) {
                  // Skip .class files and large/binary files
                  const stat = fs.statSync(fullPath);
                  if (stat.size > 1024 * 256) continue; // skip files > 256 KB

                  const buf = fs.readFileSync(fullPath);
                  // Skip binary files (check for null bytes)
                  if (buf.includes(0)) continue;

                  const content = buf.toString('utf-8');
                  const original = files[relPath];
                  // Only send back new files or files whose content changed
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

          // Close the exec WebSocket — each execution is a single session.
          // Keeping it open leaks resources on the free tier.
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

// ---------------------------------------------------------------------------
//  Judge0 batch execution (kept as fallback)
// ---------------------------------------------------------------------------
function httpsRequest(method, url, jsonBody) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = jsonBody ? JSON.stringify(jsonBody) : null;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function executeCode(body) {
  const { language, source_code, stdin } = body;
  const languageId = LANGUAGE_IDS[language] || LANGUAGE_IDS.java;
  console.log(`[exec] Submitting ${language} (id=${languageId}) to Judge0`);

  try {
    const judge0Url = `https://${JUDGE0_HOST}/submissions?base64_encoded=false&wait=true`;
    const { statusCode, body: respBody } = await httpsRequest('POST', judge0Url, {
      language_id: languageId,
      source_code,
      stdin: stdin || '',
    });

    console.log(`[exec] Judge0 responded with ${statusCode}`);

    if (statusCode >= 200 && statusCode < 300) {
      const j = JSON.parse(respBody);
      const result = {
        language: language || 'java',
        version: '',
        run: {
          stdout: j.stdout || '',
          stderr: j.stderr || '',
          code: j.status?.id === 3 ? 0 : (j.status?.id || 1),
          signal: null,
          output: (j.stdout || '') + (j.stderr || ''),
        },
      };
      if (j.compile_output) {
        result.compile = {
          stdout: '',
          stderr: j.compile_output,
          code: j.status?.id === 6 ? 1 : 0,
          signal: null,
          output: j.compile_output,
        };
      }
      if (j.message) {
        result.run.stderr = j.message + (result.run.stderr ? '\n' + result.run.stderr : '');
        result.run.output = result.run.stderr + result.run.stdout;
      }
      return { status: 200, data: result };
    }

    return { status: statusCode, data: { error: respBody } };
  } catch (err) {
    console.log(`[exec] Judge0 failed: ${err.message}`);
    return { status: 502, data: { error: `Execution backend unavailable: ${err.message}` } };
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
//  HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /execute — batch execution via Judge0 (fallback)
  if (req.method === 'POST' && req.url === '/execute') {
    try {
      const body = await readBody(req);
      const result = await executeCode(body);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request body' }));
    }
    return;
  }

  // Health check
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    service: 'collab-code-sync',
    javaAvailable,
  }));
});

// ---------------------------------------------------------------------------
//  WebSocket routing
// ---------------------------------------------------------------------------
// Two WebSocket.Servers — one for Yjs sync, one for interactive execution.
// We handle the HTTP upgrade manually to route by path.
const syncWss = new WebSocket.Server({ noServer: true });
const execWss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/exec') {
    execWss.handleUpgrade(request, socket, head, (ws) => {
      execWss.emit('connection', ws, request);
    });
  } else {
    // Everything else goes to Yjs sync (room name comes from the URL path)
    syncWss.handleUpgrade(request, socket, head, (ws) => {
      syncWss.emit('connection', ws, request);
    });
  }
});

syncWss.on('connection', (ws, req) => {
  console.log(`[sync] New connection: ${req.url}`);
  setupWSConnection(ws, req);
});

execWss.on('connection', (ws) => {
  console.log(`[exec] New interactive execution session`);
  handleExecConnection(ws);
});

// ---------------------------------------------------------------------------
//  Start
// ---------------------------------------------------------------------------
server.listen(PORT, HOST, () => {
  console.log(`[collab-code] Server running on ${HOST}:${PORT}`);
  console.log(`[collab-code] Yjs sync: ws://${HOST}:${PORT}/<room>`);
  console.log(`[collab-code] Interactive exec: ws://${HOST}:${PORT}/exec`);
  console.log(`[collab-code] Judge0 fallback: POST http://${HOST}:${PORT}/execute`);
});

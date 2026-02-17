/**
 * Lightweight Yjs WebSocket + code execution server for Collab Code.
 *
 * - Relays Yjs document updates and awareness between clients via WebSocket
 * - Proxies code execution to Judge0 CE (free, no API key required)
 *
 * Usage:
 *   node server/index.cjs              # default port 4444
 *   PORT=8080 node server/index.cjs    # custom port
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = parseInt(process.env.PORT || '4444', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Judge0 CE public instance — free, no API key required.
// Language IDs: https://ce.judge0.com/languages
const JUDGE0_HOST = process.env.JUDGE0_HOST || 'ce.judge0.com';

// Map language names to Judge0 language IDs
const LANGUAGE_IDS = {
  java: 91,       // Java (JDK 17.0.6)
  python: 92,     // Python (3.11.2)
  javascript: 97, // JavaScript (Node.js 20.17.0)
  c: 75,          // C (Clang 18.1.8)
  cpp: 76,        // C++ (Clang 18.1.8)
};

/**
 * Make an HTTPS request using Node's built-in https module.
 */
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

/**
 * Execute code via Judge0 CE and normalize the response to match
 * the format the frontend expects (Piston-compatible).
 */
async function executeCode(body) {
  const { language, source_code } = body;
  const languageId = LANGUAGE_IDS[language] || LANGUAGE_IDS.java;

  console.log(`[exec] Submitting ${language} (id=${languageId}) to Judge0`);

  try {
    const judge0Url = `https://${JUDGE0_HOST}/submissions?base64_encoded=false&wait=true`;
    const { statusCode, body: respBody } = await httpsRequest('POST', judge0Url, {
      language_id: languageId,
      source_code,
    });

    console.log(`[exec] Judge0 responded with ${statusCode}`);

    if (statusCode >= 200 && statusCode < 300) {
      const j = JSON.parse(respBody);

      // Normalize Judge0 response to Piston-like format that the frontend expects
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

      // Judge0 status IDs: 3=Accepted, 6=Compilation Error, 5=Time Limit, 11=Runtime Error
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

/**
 * Parse incoming request body as JSON.
 */
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

const server = http.createServer(async (req, res) => {
  // CORS — allow the GitHub Pages frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /execute — proxy code execution to Judge0 CE
  if (req.method === 'POST' && req.url === '/execute') {
    try {
      const body = await readBody(req);
      const result = await executeCode(body);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request body' }));
    }
    return;
  }

  // Health check
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'collab-code-sync' }));
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  // The room name comes from the URL path, e.g. ws://host:4444/collab-code-a1b2c3d4
  // y-websocket's setupWSConnection parses req.url automatically.
  console.log(`[sync] New connection: ${req.url}`);
  setupWSConnection(ws, req);
});

server.listen(PORT, HOST, () => {
  console.log(`[collab-code] Sync server running on ws://${HOST}:${PORT}`);
  console.log(`[collab-code] Rooms are created on demand from client URL hashes`);
});

/**
 * Lightweight Yjs WebSocket server for Collab Code.
 *
 * Each room URL hash maps to a separate Yjs document.
 * The server:
 *   - Relays Yjs document updates between connected clients
 *   - Relays awareness updates (cursors, user names, colors)
 *   - Keeps a copy of each document in memory so late joiners
 *     get the full state instantly (no waiting for a peer)
 *   - Optionally persists documents to disk via LevelDB
 *
 * Usage:
 *   node server/index.cjs              # default port 4444
 *   PORT=8080 node server/index.cjs    # custom port
 */

const http = require('http');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = parseInt(process.env.PORT || '4444', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Piston public API for code execution.
// Falls back through multiple known instances.
const PISTON_URLS = [
  'https://emkc.org/api/v2/piston/execute',
  'https://piston.e-z.host/api/v2/execute',
];

/**
 * Try each Piston endpoint in order until one succeeds.
 */
async function executePiston(body) {
  for (const url of PISTON_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return { status: res.status, data: await res.json() };
      // If 401/403, try next endpoint
      if (res.status === 401 || res.status === 403) continue;
      // Other errors — return as-is
      return { status: res.status, data: await res.text() };
    } catch {
      continue; // network error, try next
    }
  }
  return { status: 502, data: { error: 'All execution backends unavailable' } };
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

  // POST /execute — proxy code execution to Piston
  if (req.method === 'POST' && req.url === '/execute') {
    try {
      const body = await readBody(req);
      const result = await executePiston(body);
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

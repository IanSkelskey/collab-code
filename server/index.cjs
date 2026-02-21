/**
 * Collab Code server entry point.
 *
 * - Y.js document sync relay via WebSocket (any path except /exec)
 * - Interactive Java execution via WebSocket (/exec)
 *
 * Usage:
 *   node server/index.cjs              # default port 4444
 *   PORT=8080 node server/index.cjs    # custom port
 */

const http = require('http');
const { URL } = require('url');
const WebSocket = require('ws');
const { handleExecConnection, isJavaAvailable } = require('./exec.cjs');
const { handleSyncConnection } = require('./sync.cjs');

const PORT = parseInt(process.env.PORT || '4444', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ---------------------------------------------------------------------------
//  HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    service: 'collab-code-sync',
    javaAvailable: isJavaAvailable(),
  }));
});

// ---------------------------------------------------------------------------
//  WebSocket routing
// ---------------------------------------------------------------------------
const syncWss = new WebSocket.Server({ noServer: true });
const execWss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/exec') {
    execWss.handleUpgrade(request, socket, head, (ws) => {
      execWss.emit('connection', ws, request);
    });
  } else {
    syncWss.handleUpgrade(request, socket, head, (ws) => {
      syncWss.emit('connection', ws, request);
    });
  }
});

syncWss.on('connection', handleSyncConnection);

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
});

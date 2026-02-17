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

const server = http.createServer((_req, res) => {
  // Health check endpoint — useful for deployment readiness probes
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

/**
 * Y.js document sync relay over WebSocket.
 *
 * Delegates to y-websocket's built-in setupWSConnection which handles
 * document persistence, awareness, and update broadcasting.
 */

const { setupWSConnection } = require('y-websocket/bin/utils');

function handleSyncConnection(ws, req) {
  console.log(`[sync] New connection: ${req.url}`);
  setupWSConnection(ws, req);
}

module.exports = { handleSyncConnection };

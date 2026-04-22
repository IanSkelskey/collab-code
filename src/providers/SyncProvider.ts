import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

/**
 * Default WebSocket server URL.
 * In development this points to your local server.
 * In production, set VITE_WS_URL to your deployed server address.
 *
 * Examples:
 *   Local dev:    ws://localhost:4444
 *   Production:   wss://collab-code-sync.your-domain.com
 */
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4444';

/**
 * A thin wrapper around y-websocket's WebsocketProvider.
 *
 * All peers connect to a lightweight Node server over a standard
 * WebSocket (port 80/443), which works through virtually every
 * campus firewall and NAT. The server relays Yjs document updates
 * and awareness (cursors, names, colors) between clients.
 *
 * Advantages over the previous Trystero/WebRTC approach:
 *   - Works behind symmetric NAT / CGNAT (campus WiFi)
 *   - No dependency on third-party MQTT brokers or TURN servers
 *   - Instant state sync for late joiners (server holds doc in memory)
 *   - Sub-50ms latency on the same LAN
 */
export class CollabProvider {
  readonly awareness: Awareness;
  readonly doc: Y.Doc;

  private wsProvider: WebsocketProvider;

  constructor(roomId: string, doc: Y.Doc) {
    this.doc = doc;

    console.log(`[CollabCode] Connecting to sync server: ${WS_URL}/${roomId}`);

    // y-websocket handles:
    //   - Reconnection with exponential backoff
    //   - Full document sync on initial connect
    //   - Incremental update relay between peers
    //   - Awareness protocol (cursors, presence)
    this.wsProvider = new WebsocketProvider(WS_URL, roomId, doc, {
      connect: true,
    });

    this.awareness = this.wsProvider.awareness;
  }

  /** Whether the WebSocket is currently connected. */
  get connected(): boolean {
    return this.wsProvider.wsconnected;
  }

  /** Subscribe to provider events (e.g. 'status'). */
  on(
    event: 'status',
    callback: (event: { status: 'connected' | 'connecting' | 'disconnected' }) => void,
  ): void;
  on(event: 'sync', callback: (state: boolean) => void): void;
  on(event: 'connection-close' | 'connection-error', callback: (...args: unknown[]) => void): void;
  on(
    event: 'status' | 'sync' | 'connection-close' | 'connection-error',
    callback:
      | ((event: { status: 'connected' | 'connecting' | 'disconnected' }) => void)
      | ((state: boolean) => void)
      | ((...args: unknown[]) => void),
  ) {
    this.wsProvider.on(event, callback as never);
  }

  off(
    event: 'status',
    callback: (event: { status: 'connected' | 'connecting' | 'disconnected' }) => void,
  ): void;
  off(event: 'sync', callback: (state: boolean) => void): void;
  off(event: 'connection-close' | 'connection-error', callback: (...args: unknown[]) => void): void;
  off(
    event: 'status' | 'sync' | 'connection-close' | 'connection-error',
    callback:
      | ((event: { status: 'connected' | 'connecting' | 'disconnected' }) => void)
      | ((state: boolean) => void)
      | ((...args: unknown[]) => void),
  ) {
    this.wsProvider.off(event, callback as never);
  }

  destroy() {
    this.wsProvider.disconnect();
    this.wsProvider.destroy();
  }
}

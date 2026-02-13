import * as Y from 'yjs';
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { joinRoom } from 'trystero/mqtt';

/**
 * A Yjs provider that uses Trystero (MQTT brokers) for peer
 * discovery and WebRTC data channels for document sync.
 *
 * No dedicated signaling server required — peers find each other
 * through free public MQTT brokers (HiveMQ, EMQX). These are
 * enterprise-grade infrastructure designed for high-throughput
 * IoT messaging, so signaling traffic for a few peers is trivial
 * and never rate-limited.
 */
export class TrysteroProvider {
  readonly awareness: Awareness;
  readonly doc: Y.Doc;

  private room: ReturnType<typeof joinRoom>;
  private peerClientIds = new Map<string, number>();
  private updateHandler: (update: Uint8Array, origin: unknown) => void;
  private awarenessUpdateHandler: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => void;

  constructor(roomId: string, doc: Y.Doc) {
    this.doc = doc;
    this.awareness = new Awareness(doc);

    console.log('[CollabCode] Joining room:', roomId, '(MQTT broker strategy)');

    // Join a Trystero room using the MQTT broker strategy.
    // Peers discover each other via free public MQTT brokers.
    // MQTT brokers are designed for massive IoT message throughput —
    // signaling a handful of WebRTC peers is trivial, so no rate limits.
    //
    // ICE servers:
    // - Google STUN for basic NAT traversal (free, always up)
    // - TURN on port 3478 for moderate firewalls
    // - TURNS on port 443 (TLS) for restrictive firewalls (campus WiFi, etc.)
    this.room = joinRoom(
      {
        appId: 'collab-code',
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            {
              urls: [
                'turn:relay1.expressturn.com:3478',
                'turns:relay1.expressturn.com:443',
              ],
              username: 'efQUQ79N77B5BNVVKF',
              credential: 'N4EAUgpjMzPLrxSS',
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject',
            },
            {
              urls: 'turns:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject',
            },
          ],
          iceTransportPolicy: 'all',
        },
      },
      roomId
    );

    // --- Data channels ---
    const [sendDocUpdate, getDocUpdate] = this.room.makeAction<Uint8Array>('doc');
    const [sendAwareness, getAwareness] = this.room.makeAction<Uint8Array>('aw');
    const [sendFullState, getFullState] = this.room.makeAction<Uint8Array>('sync');
    const [sendClientId, getClientId] = this.room.makeAction<number>('cid');

    // --- Peer lifecycle ---

    this.room.onPeerJoin((peerId: string) => {
      console.log('[CollabCode] Peer joined:', peerId);
      // Tell the new peer our Yjs clientID so they can clean up our
      // awareness state if we disconnect.
      sendClientId(doc.clientID, peerId);

      // Send our full document state — Yjs deduplicates internally
      // so it's safe even if both peers do this simultaneously.
      const state = Y.encodeStateAsUpdate(doc);
      sendFullState(state, peerId);

      // Send our current awareness (cursor position, name, color)
      const aw = encodeAwarenessUpdate(this.awareness, [doc.clientID]);
      sendAwareness(aw, peerId);
    });

    this.room.onPeerLeave((peerId: string) => {
      console.log('[CollabCode] Peer left:', peerId);
      // Remove the departed peer's awareness state so their cursor disappears
      const clientId = this.peerClientIds.get(peerId);
      if (clientId !== undefined) {
        removeAwarenessStates(this.awareness, [clientId], this);
        this.peerClientIds.delete(peerId);
      }
    });

    // --- Incoming data handlers ---

    getClientId((clientId: number, peerId: string) => {
      this.peerClientIds.set(peerId, clientId);
    });

    getFullState((state, _peerId: string) => {
      Y.applyUpdate(doc, new Uint8Array(state), this);
    });

    getDocUpdate((update, _peerId: string) => {
      Y.applyUpdate(doc, new Uint8Array(update), this);
    });

    getAwareness((update, _peerId: string) => {
      applyAwarenessUpdate(this.awareness, new Uint8Array(update), this);
    });

    // --- Outgoing: broadcast local changes ---

    this.updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin !== this) {
        sendDocUpdate(update);
      }
    };
    doc.on('update', this.updateHandler);

    this.awarenessUpdateHandler = (
      { added, updated, removed },
      _origin
    ) => {
      const changed = added.concat(updated).concat(removed);
      const encoded = encodeAwarenessUpdate(this.awareness, changed);
      sendAwareness(encoded);
    };
    this.awareness.on('update', this.awarenessUpdateHandler);
  }

  destroy() {
    this.doc.off('update', this.updateHandler);
    this.awareness.off('update', this.awarenessUpdateHandler);
    this.room.leave();
    this.awareness.destroy();
  }
}

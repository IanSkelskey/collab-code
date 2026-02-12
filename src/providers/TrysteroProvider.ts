import * as Y from 'yjs';
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { joinRoom } from 'trystero/torrent';

/**
 * A Yjs provider that uses Trystero (BitTorrent/WebTorrent trackers)
 * for peer discovery and WebRTC data channels for document sync.
 *
 * No dedicated signaling server required — peers find each other
 * through the public WebTorrent tracker network.
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

    // Join a Trystero room using the BitTorrent/WebTorrent tracker strategy.
    // Peers discover each other via public tracker WebSocket servers —
    // no custom signaling server needed.
    //
    // Config mirrors Chitchatter's proven cross-network setup:
    // - relayUrls omitted → Trystero uses its own maintained tracker list
    // - relayRedundancy: 4 → connect through 4 trackers simultaneously
    // - ExpressTURN for NAT traversal (same server Chitchatter uses)
    this.room = joinRoom(
      {
        appId: 'collab-code',
        relayRedundancy: 4,
        rtcConfig: {
          iceServers: [
            {
              urls: ['turn:relay1.expressturn.com:3478'],
              username: 'efQUQ79N77B5BNVVKF',
              credential: 'N4EAUgpjMzPLrxSS',
            },
          ],
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

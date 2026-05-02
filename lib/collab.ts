"use client";

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import type { Schema } from "./types";

export interface PeerInfo {
  id: number;
  name: string;
  color: string;
  // Optional cursor position in flow coordinates.
  cursor?: { x: number; y: number };
}

export interface CollabSession {
  doc: Y.Doc;
  provider: WebrtcProvider;
  schemaMap: Y.Map<unknown>;
  destroy: () => void;
}

const PEER_COLORS = [
  "#4f46e5",
  "#db2777",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#ea580c",
];

export function pickPeerColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length];
}

// Public signaling servers run by the y-webrtc maintainers. For production
// you'd run your own; for a "ship today" feature these get the job done.
const SIGNALING = [
  "wss://y-webrtc-signaling-eu.fly.dev",
  "wss://signaling.yjs.dev",
];

/**
 * Open a collaborative session for `roomId`. Peers in the same room sync via
 * WebRTC (peer-to-peer; a public signaling server brokers the handshake).
 * The schema-store JSON is mirrored into the Y.Map under "json".
 */
export function openCollabSession(
  roomId: string,
  identity: { name: string; color: string }
): CollabSession {
  const doc = new Y.Doc();
  const provider = new WebrtcProvider(`super-schema:${roomId}`, doc, {
    signaling: SIGNALING,
  });
  const schemaMap = doc.getMap<unknown>("schema");

  provider.awareness.setLocalStateField("user", {
    name: identity.name,
    color: identity.color,
  });

  return {
    doc,
    provider,
    schemaMap,
    destroy: () => {
      try {
        provider.disconnect();
      } catch {
        /* ignore */
      }
      try {
        provider.destroy();
      } catch {
        /* ignore */
      }
      doc.destroy();
    },
  };
}

export function readSchemaFromDoc(map: Y.Map<unknown>): Schema | null {
  const raw = map.get("json");
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Schema;
    if (
      parsed &&
      Array.isArray(parsed.tables) &&
      Array.isArray(parsed.relations)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSchemaToDoc(
  doc: Y.Doc,
  map: Y.Map<unknown>,
  schema: Schema,
  origin: object
): void {
  doc.transact(() => {
    map.set("json", JSON.stringify(schema));
  }, origin);
}

export function listPeers(provider: WebrtcProvider): PeerInfo[] {
  const states = provider.awareness.getStates();
  const localId = provider.awareness.clientID;
  const peers: PeerInfo[] = [];
  states.forEach((state, id) => {
    if (id === localId) return;
    const user = (state as { user?: { name?: string; color?: string } }).user;
    const cursor = (state as { cursor?: { x: number; y: number } }).cursor;
    peers.push({
      id,
      name: user?.name ?? "Guest",
      color: user?.color ?? "#888",
      cursor,
    });
  });
  return peers;
}

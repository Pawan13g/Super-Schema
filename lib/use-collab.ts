"use client";

import { useEffect, useRef, useState } from "react";
import {
  listPeers,
  openCollabSession,
  pickPeerColor,
  readSchemaFromDoc,
  writeSchemaToDoc,
  type CollabSession,
  type PeerInfo,
} from "./collab";
import type { Schema } from "./types";

export interface CollabState {
  enabled: boolean;
  status: "off" | "connecting" | "connected";
  peers: PeerInfo[];
}

interface UseCollabOptions {
  roomId: string | null;
  enabled: boolean;
  identity: { name: string };
  schema: Schema;
  onRemoteSchema: (schema: Schema) => void;
  // When true, never seed our local schema into the doc and never push local
  // edits until we've received a remote snapshot. This is for users who
  // joined via an invite link — their local store is unrelated to the
  // host's schema, so seeding would silently overwrite the host's data the
  // moment the host connects.
  joinAsGuest?: boolean;
}

/**
 * Mirror the schema store with a Y.Doc when collab is enabled. Local edits
 * push into the doc; remote updates push back into the store. Origin tags
 * prevent feedback loops.
 */
export function useCollab(opts: UseCollabOptions): CollabState {
  const { roomId, enabled, identity, schema, onRemoteSchema, joinAsGuest } = opts;
  const sessionRef = useRef<CollabSession | null>(null);
  const guestAdoptedRef = useRef(false);
  // Sentinel object used as a Yjs transaction origin so we can ignore our
  // own writes when reading back update events. Yjs requires an object (not
  // a Symbol), so a frozen empty object suffices.
  const localOriginRef = useRef<object>({});
  const lastWrittenJsonRef = useRef<string>("");
  const [status, setStatus] = useState<CollabState["status"]>("off");
  const [peers, setPeers] = useState<PeerInfo[]>([]);

  // Open / close the session on enable + roomId change. setState calls here
  // are the *whole point* of this effect (UI follows session lifecycle).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!enabled || !roomId) {
      sessionRef.current?.destroy();
      sessionRef.current = null;
      setStatus("off");
      setPeers([]);
      return;
    }

    const color = pickPeerColor(identity.name + roomId);
    const session = openCollabSession(roomId, {
      name: identity.name,
      color,
    });
    sessionRef.current = session;
    setStatus("connecting");

    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      // Ignore our own writes.
      if (origin === localOriginRef.current) return;
      const remote = readSchemaFromDoc(session.schemaMap);
      if (!remote) return;
      const json = JSON.stringify(remote);
      if (json === lastWrittenJsonRef.current) return;
      lastWrittenJsonRef.current = json;
      guestAdoptedRef.current = true;
      onRemoteSchema(remote);
    };
    session.doc.on("update", onUpdate);

    const onAwareness = () => {
      setPeers(listPeers(session.provider));
    };
    session.provider.awareness.on("change", onAwareness);

    const onPeers = () => {
      setStatus("connected");
      setPeers(listPeers(session.provider));
    };
    session.provider.on("peers", onPeers);

    // Defer the seeding decision until the WebRTC provider tells us the doc
    // is synced. Otherwise two peers entering an empty room within one RTT
    // each see "no data yet" and both seed their own schema, with the late
    // writer silently winning (data loss for one of them). After `synced`
    // fires the doc reflects the merged state from any peer that arrived
    // first; only THEN do we decide whether to inherit or seed.
    let seeded = false;
    const seedIfFirst = () => {
      if (seeded) return;
      seeded = true;
      setStatus("connected");
      setPeers(listPeers(session.provider));
      const initial = readSchemaFromDoc(session.schemaMap);
      if (initial) {
        lastWrittenJsonRef.current = JSON.stringify(initial);
        guestAdoptedRef.current = true;
        onRemoteSchema(initial);
      } else if (!joinAsGuest) {
        // Genuinely first peer — push our local state so the next peer to
        // join inherits it. Skip for guests joining via invite link: their
        // local schema is unrelated to the host's, and seeding would
        // overwrite the host's data once they connect.
        writeSchemaToDoc(
          session.doc,
          session.schemaMap,
          schema,
          localOriginRef.current
        );
        lastWrittenJsonRef.current = JSON.stringify(schema);
      }
    };
    session.provider.on("synced", seedIfFirst);
    // Belt-and-braces: if no peer responds within 1.5s assume we're alone
    // and seed anyway. y-webrtc's `synced` event only fires after at least
    // one peer connection completes, so a truly solo session would hang
    // without this fallback. Guests skip the auto-seed and stay in
    // connecting state until the host pushes a snapshot.
    const seedTimer = joinAsGuest ? null : setTimeout(seedIfFirst, 1500);

    setPeers(listPeers(session.provider));

    return () => {
      if (seedTimer) clearTimeout(seedTimer);
      session.doc.off("update", onUpdate);
      session.provider.awareness.off("change", onAwareness);
      session.provider.off("peers", onPeers);
      session.provider.off("synced", seedIfFirst);
      session.destroy();
      sessionRef.current = null;
      setStatus("off");
    };
    // We deliberately don't depend on `schema` / `onRemoteSchema` here — the
    // session lifecycle is keyed only on enable + room. Schema changes are
    // pushed by the second effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId, identity.name, joinAsGuest]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Push local schema changes into the Y.Doc.
  useEffect(() => {
    if (!enabled) return;
    const session = sessionRef.current;
    if (!session) return;
    // Guest hasn't received the host's snapshot yet — any local edit at this
    // point is from their unrelated local store and would overwrite the host
    // on join. Block writes until guestAdoptedRef flips.
    if (joinAsGuest && !guestAdoptedRef.current) return;
    const json = JSON.stringify(schema);
    if (json === lastWrittenJsonRef.current) return;
    lastWrittenJsonRef.current = json;
    writeSchemaToDoc(
      session.doc,
      session.schemaMap,
      schema,
      localOriginRef.current
    );
  }, [enabled, schema, joinAsGuest]);

  return { enabled, status, peers };
}

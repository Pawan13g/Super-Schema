"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

type Updater<T> = T | ((prev: T) => T);

// Per-key snapshot cache. `useSyncExternalStore` requires its `getSnapshot`
// to return a referentially stable value when the underlying store hasn't
// changed; without a cache we'd parse JSON on every render and trip an
// "infinite loop in useSyncExternalStore" warning. We key by the storage
// key itself plus the raw string we last parsed, so a write from another
// tab (which we observe via the `storage` event) invalidates the entry.
const snapshotCache = new Map<
  string,
  { raw: string | null; parsed: unknown }
>();

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readSnapshot<T>(
  key: string,
  initial: T,
  validate: ((raw: unknown) => raw is T) | undefined
): T {
  const raw = readRaw(key);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) {
    return cached.parsed as T;
  }
  if (raw === null) {
    snapshotCache.set(key, { raw: null, parsed: initial });
    return initial;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    // VALIDATE BEFORE COMMIT: if the persisted value doesn't match the
    // expected shape (corrupt entry, schema change), fall back to the
    // caller-supplied `initial` instead of letting bad data flow through.
    if (validate && !validate(parsed)) {
      snapshotCache.set(key, { raw, parsed: initial });
      return initial;
    }
    snapshotCache.set(key, { raw, parsed: parsed as T });
    return parsed as T;
  } catch {
    snapshotCache.set(key, { raw, parsed: initial });
    return initial;
  }
}

// Per-key listener set so a write through `useStoredState`'s setter notifies
// all hooks reading the same key in the same tab. The `storage` event only
// fires across tabs, not within the writing tab, so we maintain a manual
// pub-sub for in-tab consistency.
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of set) fn();
}

function subscribe(key: string, callback: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(callback);

  // Cross-tab updates arrive via the `storage` event. We invalidate the
  // cache and notify only on writes that match our key.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== key && e.key !== null) return;
    snapshotCache.delete(key);
    callback();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    set!.delete(callback);
    if (set!.size === 0) listeners.delete(key);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/**
 * useState that persists to localStorage.
 *
 * Implementation notes:
 * - Backed by `useSyncExternalStore` so the React-recommended hydration
 *   path applies: the server snapshot is always `initial`, the client
 *   first-paint snapshot is also `initial`, and the persisted value is
 *   committed on the next render after mount. No setState-in-effect.
 * - `validate` runs BEFORE the parsed value is ever returned as state, so
 *   corrupt JSON or stale-shape entries cleanly fall back to `initial`
 *   without briefly flashing bad data.
 * - Cross-tab sync: a write in tab A is observed in tab B via the
 *   `storage` event, which invalidates the cache and re-reads.
 * - Same-tab sync: writes go through this hook's setter, which also
 *   notifies any other consumer of the same key.
 */
export function useStoredState<T>(
  key: string,
  initial: T,
  options: { validate?: (raw: unknown) => raw is T } = {}
): [T, (value: Updater<T>) => void] {
  const validate = options.validate;

  // Pin the validator and initial so the snapshot reader closure doesn't
  // resubscribe on every render even if callers pass inline values.
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const initialRef = useRef(initial);
  // Refresh `initial` only if the caller actually changes its identity.
  // For primitive defaults this rarely matters; for object defaults the
  // caller is expected to memoize, same as React's own contract.
  if (initialRef.current !== initial) initialRef.current = initial;

  const subscribeForKey = useCallback(
    (cb: () => void) => subscribe(key, cb),
    [key]
  );
  const getSnapshot = useCallback(
    () => readSnapshot<T>(key, initialRef.current, validateRef.current),
    [key]
  );
  const getServerSnapshot = useCallback(() => initialRef.current, []);

  const value = useSyncExternalStore(
    subscribeForKey,
    getSnapshot,
    getServerSnapshot
  );

  const set = useCallback(
    (next: Updater<T>) => {
      const prev = readSnapshot<T>(key, initialRef.current, validateRef.current);
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        }
      } catch {
        /* quota / private mode — silently drop, but still update in-memory
           state below so the UI stays consistent. */
      }
      // Invalidate cache so the next snapshot read returns the new value
      // without going through JSON.parse again.
      snapshotCache.set(key, {
        raw: (() => {
          try {
            return JSON.stringify(resolved);
          } catch {
            return null;
          }
        })(),
        parsed: resolved,
      });
      notify(key);
    },
    [key]
  );

  // No-op on the server. Kept so the hook signature matches a plain
  // `useState` for swap-in convenience.
  useEffect(() => {
    /* presence-only — useSyncExternalStore handles hydration */
  }, []);

  return [value, set];
}

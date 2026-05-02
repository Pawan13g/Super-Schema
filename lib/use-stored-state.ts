"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Updater<T> = T | ((prev: T) => T);

/**
 * useState that persists to localStorage. The first render always emits
 * `initial` so server-rendered HTML matches the client's first-paint HTML —
 * the persisted value is hydrated after mount. Writes on every change.
 * Tolerates JSON-parse failures from old / corrupted entries.
 */
export function useStoredState<T>(
  key: string,
  initial: T,
  options: { validate?: (raw: unknown) => raw is T } = {}
): [T, (value: Updater<T>) => void] {
  const validate = options.validate;

  const [value, setValue] = useState<T>(initial);

  // Hydrate from storage once on mount. Avoids reading during the initial
  // render (which would diverge from SSR HTML and trigger React's hydration
  // mismatch error).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      const parsed = JSON.parse(raw) as unknown;
      if (validate && !validate(parsed)) return;
      setValue(parsed as T);
    } catch {
      /* corrupt entry — keep `initial` */
    }
    // Read once. Re-running on `validate` change is unnecessary: the key
    // is stable per-call-site and the validator is reference-equal across
    // renders in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Skip the first write so we don't blast the persisted value with
  // `initial` before the hydrate-from-storage effect has run.
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / private mode — silently drop */
    }
  }, [key, value]);

  const set = useCallback((next: Updater<T>) => {
    setValue((prev) =>
      typeof next === "function" ? (next as (p: T) => T)(prev) : next
    );
  }, []);

  return [value, set];
}

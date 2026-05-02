"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Updater<T> = T | ((prev: T) => T);

/**
 * useState that persists to localStorage. Reads on first render (SSR-safe
 * fallback to `initial`), writes on every change. Tolerates JSON-parse
 * failures from old / corrupted entries.
 */
export function useStoredState<T>(
  key: string,
  initial: T,
  options: { validate?: (raw: unknown) => raw is T } = {}
): [T, (value: Updater<T>) => void] {
  const validate = options.validate;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw) as unknown;
      if (validate && !validate(parsed)) return initial;
      return parsed as T;
    } catch {
      return initial;
    }
  });

  // Skip the first write so we don't overwrite the persisted value with
  // `initial` on a hydration mismatch (server-rendered placeholder vs the
  // hydrated client value).
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

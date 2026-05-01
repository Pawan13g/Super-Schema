"use client";

// Platform detection + keyboard shortcut helpers. Centralized so the UI
// labels and the actual handlers stay in sync.

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPad|iPod|iPhone/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent
  );

/** Cmd on macOS, Ctrl elsewhere. */
export const modKey = isMac ? "⌘" : "Ctrl";

/** Alt on macOS shows as ⌥ for clarity. */
export const altKey = isMac ? "⌥" : "Alt";

/** Shift label. */
export const shiftKey = isMac ? "⇧" : "Shift";

/**
 * True when the platform-conventional modifier (Meta on Mac, Ctrl elsewhere)
 * is held. Use this in keydown handlers instead of checking ctrlKey directly.
 */
export function isMod(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}

/**
 * True when the event target is a typing surface — input, textarea, select,
 * or contenteditable. Use to bail out of canvas shortcuts while the user
 * is editing text.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

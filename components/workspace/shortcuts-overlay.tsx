"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isMac, modKey, shiftKey } from "@/lib/shortcuts";

interface Shortcut {
  keys: string[];
  label: string;
}

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: "File",
    items: [
      { keys: [modKey, "S"], label: "Save schema now" },
      { keys: [modKey, "N"], label: "New table" },
      { keys: [modKey, "T"], label: "New table (alt)" },
    ],
  },
  {
    title: "Edit",
    items: [
      { keys: [modKey, "Z"], label: "Undo" },
      { keys: [modKey, shiftKey, "Z"], label: "Redo" },
      { keys: [modKey, "Y"], label: "Redo (alt)" },
      { keys: [modKey, "C"], label: "Copy selected table" },
      { keys: [modKey, "V"], label: "Paste table" },
      { keys: [modKey, "D"], label: "Duplicate selected table" },
      { keys: ["R"], label: "Rename selected table" },
      { keys: [shiftKey, "C"], label: "Add column to selected table" },
      { keys: ["Delete"], label: "Delete selected table or relation" },
      { keys: ["Backspace"], label: "Delete selected (alt)" },
      { keys: [modKey, "A"], label: "Select all tables" },
      { keys: ["Esc"], label: "Clear selection / close menus" },
    ],
  },
  {
    title: "Canvas",
    items: [
      { keys: ["F"], label: "Fit canvas to view" },
      { keys: [shiftKey, "L"], label: "Auto-arrange tables" },
      { keys: [shiftKey, "R"], label: "Open relation dialog" },
      { keys: ["="], label: "Zoom in" },
      { keys: ["-"], label: "Zoom out" },
      { keys: ["Click edge"], label: "Select relation (Delete to remove)" },
      { keys: ["Right-click"], label: "Context menu (table / edge / pane)" },
      { keys: ["Drag handle"], label: "Create a relation between columns" },
      { keys: ["Double-click"], label: "Rename table" },
      { keys: ["Mouse wheel"], label: "Zoom" },
      { keys: ["Space + drag"], label: "Pan canvas" },
    ],
  },
  {
    title: "Search & navigation",
    items: [
      { keys: [modKey, "K"], label: "Open command palette" },
      { keys: ["/"], label: "Focus sidebar search" },
      { keys: ["?"], label: "Show this shortcuts overlay" },
    ],
  },
  {
    title: "AI chat",
    items: [
      { keys: ["Enter"], label: "Send message" },
      { keys: [shiftKey, "Enter"], label: "Newline" },
    ],
  },
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isEditable(e.target)) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <Kbd>?</Kbd> anytime. Modifiers shown for{" "}
            <b>{isMac ? "macOS" : "Windows / Linux"}</b>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[65vh] grid-cols-1 gap-x-6 gap-y-5 overflow-y-auto sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-foreground">{item.label}</span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground">+</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      {children}
    </kbd>
  );
}

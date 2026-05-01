"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  label: string;
}

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Canvas",
    items: [
      { keys: ["Ctrl/⌘", "Z"], label: "Undo" },
      { keys: ["Ctrl/⌘", "Shift", "Z"], label: "Redo" },
      { keys: ["Ctrl/⌘", "Y"], label: "Redo (alt)" },
      { keys: ["Right-click"], label: "Context menu (table / edge / pane)" },
      { keys: ["Drag handle"], label: "Create a relation between columns" },
      { keys: ["Double-click"], label: "Rename a table" },
    ],
  },
  {
    title: "Editor",
    items: [
      { keys: ["Ctrl/⌘", "T"], label: "Add table" },
      { keys: ["Ctrl/⌘", "N"], label: "New schema" },
    ],
  },
  {
    title: "Search & navigation",
    items: [
      { keys: ["Ctrl/⌘", "K"], label: "Open command palette" },
      { keys: ["?"], label: "Show this shortcuts overlay" },
      { keys: ["Esc"], label: "Close menus and dialogs" },
    ],
  },
  {
    title: "AI chat",
    items: [
      { keys: ["Enter"], label: "Send message" },
      { keys: ["Shift", "Enter"], label: "Newline" },
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
      // "?" with no modifiers, not while typing.
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <Kbd>?</Kbd> anytime to open this overlay.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-1 gap-5 overflow-y-auto sm:grid-cols-2">
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

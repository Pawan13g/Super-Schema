"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type PanelKey = "sidebar" | "sql" | "ai";
export type LayoutMode = "default" | PanelKey;

interface PanelLayoutValue {
  mode: LayoutMode;
  isMaximized: (panel: PanelKey) => boolean;
  // Toggle a panel between full-screen and the default 3-pane layout.
  toggle: (panel: PanelKey) => void;
  // Force back to the default layout (used by panel-close clicks etc.).
  reset: () => void;
}

const Ctx = createContext<PanelLayoutValue | null>(null);

export function PanelLayoutProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<LayoutMode>("default");

  const toggle = useCallback((panel: PanelKey) => {
    setMode((cur) => (cur === panel ? "default" : panel));
  }, []);

  const reset = useCallback(() => setMode("default"), []);

  const isMaximized = useCallback(
    (panel: PanelKey) => mode === panel,
    [mode]
  );

  return (
    <Ctx.Provider value={{ mode, isMaximized, toggle, reset }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePanelLayout(): PanelLayoutValue {
  const v = useContext(Ctx);
  if (!v) {
    return {
      mode: "default",
      isMaximized: () => false,
      toggle: () => {},
      reset: () => {},
    };
  }
  return v;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AiStatus {
  configured: boolean;
  enabled: boolean;
  provider: string | null;
  model: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AiStatus | null>(null);

// Tracks whether the user has a usable AI provider configured. Used to gate
// AI-only features (doc-gen, advisor's "Ask AI", etc.) and show lock badges.
export function AiStatusProvider({ children }: { children: ReactNode }) {
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        setConfigured(false);
        return;
      }
      const data = (await res.json()) as {
        aiEnabled?: boolean;
        aiProvider?: string | null;
        aiModel?: string | null;
        hasApiKey?: boolean;
      };
      // Ollama is local; no API key required.
      const ok =
        data.aiProvider === "ollama"
          ? true
          : !!data.hasApiKey && !!data.aiProvider;
      setConfigured(ok);
      setEnabled(data.aiEnabled !== false);
      setProvider(data.aiProvider ?? null);
      setModel(data.aiModel ?? null);
    } catch {
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fire-and-forget initial fetch; setState calls happen inside the async
    // closure, not synchronously in the effect body. Lint rule misfires.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{ configured, enabled, provider, model, loading, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAiStatus(): AiStatus {
  const v = useContext(Ctx);
  if (!v) {
    return {
      configured: false,
      enabled: false,
      provider: null,
      model: null,
      loading: false,
      refresh: async () => {},
    };
  }
  return v;
}

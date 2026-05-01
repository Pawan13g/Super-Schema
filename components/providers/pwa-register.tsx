"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Register the service worker once per session in production. Skipped in
  // dev so HMR doesn't fight the cache.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Silent — PWA install is best-effort.
        });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Capture the browser's install prompt so we can surface a button later.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      toast.success("App installed — launch it from your home screen");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Persist dismissal so we don't pester on every page load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem("super-schema:pwa-dismissed");
    if (v === "1") setDismissed(true);
  }, []);

  if (!installEvent || dismissed) return null;

  const handleInstall = async () => {
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("Installing…");
      }
      setInstallEvent(null);
    } catch {
      toast.error("Install failed");
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("super-schema:pwa-dismissed", "1");
  };

  return (
    <div className="pointer-events-auto fixed bottom-4 left-1/2 z-50 flex max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border bg-card px-3 py-2 shadow-lg sm:left-auto sm:right-4 sm:translate-x-0">
      <Download className="size-4 shrink-0 text-primary" />
      <div className="flex-1 text-xs">
        <p className="font-medium">Install Super Schema</p>
        <p className="text-muted-foreground">Run it like a native app.</p>
      </div>
      <Button size="sm" onClick={handleInstall}>
        Install
      </Button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

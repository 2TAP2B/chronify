"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Download, X, WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useOfflineQueue, replayQueue } from "@/stores/offline-queue";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaManager() {
  const t = useTranslations("pwa");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const queueSize = useOfflineQueue((s) => s.queue.length);
  const [replaying, setReplaying] = useState(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    if (wasOffline) {
      setShowBackOnline(true);
      setTimeout(() => setShowBackOnline(false), 5000);
    }
    setWasOffline(false);
    setShowOfflineBanner(false);
    // Replay queued mutations
    if (useOfflineQueue.getState().queue.length > 0) {
      setReplaying(true);
      replayQueue(() => {}).finally(() => {
        setReplaying(false);
        window.location.reload();
      });
    }
  }, [wasOffline]);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed:", err));
    }

    setIsOnline(navigator.onLine);
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowOfflineBanner(true);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, [handleOnline]);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  return (
    <>
      {/* Install prompt banner */}
      {installPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg border bg-background p-4 shadow-lg md:left-auto md:right-4">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t("installTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("installDescription")}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={handleInstall}>
                  {t("install")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setInstallPrompt(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline banner */}
      {showOfflineBanner && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-lg">
          <span className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            {t("offline")}
            {queueSize > 0 && (
              <span className="ml-2 rounded bg-destructive-foreground/20 px-1.5 py-0.5 text-xs">
                {queueSize} {t("queued")}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Replaying indicator */}
      {replaying && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">
          <span className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t("syncing")}
          </span>
        </div>
      )}

      {/* Back online toast */}
      {showBackOnline && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg">
          <span className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            {t("backOnline")}
          </span>
        </div>
      )}
    </>
  );
}

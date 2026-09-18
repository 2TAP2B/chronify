/// <reference path="../../types/web-nfc.d.ts" />

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Play, Square, XCircle, CreditCard, Download } from "lucide-react";

type KioskState = "idle" | "loading" | "started" | "stopped" | "error";

type TapResponse = {
  action: "started" | "stopped";
  userName: string;
  workedMinutes?: number;
  todayWorkedMs: number;
};

type ErrorResponse = {
  error: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function KioskScreen({ locale }: { locale: string }) {
  const t = useTranslations("kiosk");
  const [state, setState] = useState<KioskState>("idle");
  const [userName, setUserName] = useState("");
  const [workedMinutes, setWorkedMinutes] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [showManual, setShowManual] = useState(false);
  const [manualCardId, setManualCardId] = useState("");
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcActive, setNfcActive] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nfcStartingRef = useRef(false);

  useEffect(() => {
    setNfcSupported(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed:", err));
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setIsStandalone(true);
    }
  }, [installPrompt]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const scheduleRevert = useCallback((seconds: number) => {
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => {
      setState("idle");
      setUserName("");
      setWorkedMinutes(0);
      setErrorMsg("");
    }, seconds * 1000);
  }, []);

  const handleCardTap = useCallback(
    async (cardId: string) => {
      if (state === "loading") return;
      setState("loading");
      setErrorMsg("");

      try {
        const res = await fetch("/api/kiosk/tap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId }),
        });
        const data = await res.json();

        if (!res.ok) {
          const err = data as ErrorResponse;
          setState("error");
          setErrorMsg(err.error === "card_not_found" ? t("cardNotFound") : t("scanError"));
          scheduleRevert(3);
          return;
        }

        const tap = data as TapResponse;
        setUserName(tap.userName);
        if (tap.action === "started") {
          setState("started");
        } else {
          setState("stopped");
          setWorkedMinutes(tap.workedMinutes ?? 0);
        }
        scheduleRevert(5);
      } catch {
        setState("error");
        setErrorMsg(t("scanError"));
        scheduleRevert(3);
      }
    },
    [state, t, scheduleRevert]
  );

  const handleNfcScan = useCallback(async () => {
    if (!("NDEFReader" in window)) {
      setNfcError("not_available");
      return;
    }
    // Re-entry guard: focus/visibility effects and rapid taps must not start
    // concurrent NDEFReader sessions.
    if (nfcStartingRef.current) return;
    nfcStartingRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setNfcActive(true);
    setNfcError(null);

    try {
      const reader = new NDEFReader();
      // No abort on reading: the scan stays armed so consecutive taps work
      // without re-pressing the NFC button. Only onreadingerror/unmount
      // end the session.
      await reader.scan({ signal: controller.signal });
      localStorage.setItem("kiosk-nfc-pref", "1");

      reader.onreading = (event: NDEFReadingEvent) => {
        for (const record of event.message.records) {
          if (record.recordType === "text") {
            const textDecoder = new TextDecoder();
            const rfidCode = textDecoder.decode(record.data);
            const trimmed = rfidCode.trim();
            if (trimmed) {
              handleCardTap(trimmed);
            }
            // Keep scanning further cards; only the first text record per
            // reading event counts.
            return;
          }
        }
      };

      reader.onreadingerror = () => {
        setNfcError("scan_error");
      };
    } catch (e) {
      setNfcActive(false);
      localStorage.removeItem("kiosk-nfc-pref");
      const name = (e as { name?: string }).name;
      if (name === "NotAllowedError") {
        setNfcError("permission_denied");
      } else if (name === "AbortError") {
        // intentional teardown (unmount) — no error surface
      } else {
        setNfcError("scan_error");
      }
    } finally {
      nfcStartingRef.current = false;
    }
  }, [handleCardTap]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (revertTimer.current) clearTimeout(revertTimer.current);
    };
  }, []);

  // Auto re-arm: if NFC was enabled once (localStorage pref), resume scanning
  // when the kiosk becomes visible again (reload, PWA resume). Chromium
  // requires a gesture for a fresh scan() — if that fails the session falls
  // back to the manual NFC button.
  useEffect(() => {
    const tryArm = () => {
      if (
        document.visibilityState === "visible" &&
        !nfcStartingRef.current &&
        !abortControllerRef.current?.signal.aborted &&
        "NDEFReader" in window &&
        localStorage.getItem("kiosk-nfc-pref") === "1"
      ) {
        void handleNfcScan();
      }
    };
    tryArm();
    document.addEventListener("visibilitychange", tryArm);
    return () => document.removeEventListener("visibilitychange", tryArm);
  }, [handleNfcScan]);

  const localeStr = locale === "en" ? "en-US" : "de-DE";
  const timeStr = now.toLocaleTimeString(localeStr, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString(localeStr, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const workedHours = Math.floor(workedMinutes / 60);
  const workedMins = workedMinutes % 60;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6 text-center">
      {state === "idle" && (
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <p className="font-mono text-5xl font-bold tabular-nums tracking-tight">{timeStr}</p>
            <p className="text-lg text-muted-foreground capitalize">{dateStr}</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-12 w-12 text-primary" />
            </div>
            {nfcSupported && !nfcActive && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleNfcScan}
                  className="rounded-xl bg-primary px-8 py-4 text-xl font-semibold text-primary-foreground shadow-lg transition hover:bg-primary/90 active:scale-95"
                >
                  {t("enableNfc")}
                </button>
                {nfcError === "permission_denied" && (
                  <p className="text-sm text-destructive">{t("nfcPermissionDenied")}</p>
                )}
                {nfcError === "scan_error" && (
                  <p className="text-sm text-destructive">{t("scanError")}</p>
                )}
              </div>
            )}
            {nfcSupported && nfcActive && (
              <p className="text-2xl font-semibold">{t("tapPrompt")}</p>
            )}
            {!nfcSupported && (
              <p className="text-lg text-muted-foreground">{t("nfcNotSupported")}</p>
            )}
          </div>
          <button
            onClick={() => setShowManual(!showManual)}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            {t("manualEntry")}
          </button>
          {showManual && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCardId.trim()) {
                  handleCardTap(manualCardId.trim());
                  setManualCardId("");
                  setShowManual(false);
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualCardId}
                onChange={(e) => setManualCardId(e.target.value)}
                placeholder={t("cardIdPlaceholder")}
                className="rounded-lg border px-4 py-2 text-lg"
                maxLength={20}
                autoFocus
              />
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-lg font-semibold text-primary-foreground"
              >
                OK
              </button>
            </form>
          )}
          {installPrompt && !isStandalone && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 rounded-xl border-2 border-primary px-6 py-3 text-base font-semibold text-primary transition hover:bg-primary/5 active:scale-95"
            >
              <Download className="h-5 w-5" />
              {t("installApp")}
            </button>
          )}
        </div>
      )}

      {state === "loading" && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-primary/20" />
          <p className="text-2xl font-semibold">{t("loading")}</p>
        </div>
      )}

      {state === "started" && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <Play className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold">{t("hello", { name: userName })}</h1>
          <p className="text-xl text-emerald-600 font-semibold">{t("started")}</p>
        </div>
      )}

      {state === "stopped" && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Square className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">{t("hello", { name: userName })}</h1>
          <p className="text-xl font-semibold">{t("stopped")}</p>
          <p className="text-lg text-muted-foreground">
            {t("worked")}: {workedHours}h {workedMins}min
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <p className="text-2xl font-semibold text-destructive">{errorMsg}</p>
        </div>
      )}

      {(state === "started" || state === "stopped") && (
        <button
          onClick={() => {
            if (revertTimer.current) clearTimeout(revertTimer.current);
            setState("idle");
            setUserName("");
            setWorkedMinutes(0);
          }}
          className="mt-8 rounded-lg border px-6 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          {t("done")}
        </button>
      )}
    </div>
  );
}

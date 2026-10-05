/// <reference path="../../types/web-nfc.d.ts" />

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Play, Square, Coffee, LogOut, Sun, Moon, CreditCard, Download } from "lucide-react";

type TimerStatus = {
  active: boolean;
  onBreak: boolean;
  startedAt: string | null;
  breakStartedAt: string | null;
  elapsedMs: number;
  breakMs: number;
  todayWorkedMs: number;
};

type KioskSession = TimerStatus & {
  cardId: string;
  firstName: string;
  /** Date.now() when this status was fetched — elapsed grows client-side. */
  fetchedAtMs: number;
};

type TapResponse = {
  firstName: string;
  userName: string;
  status?: TimerStatus | null;
  workedMinutes?: number;
};

type ErrorResponse = {
  error: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type KioskAction = "identify" | "start" | "stop" | "break" | "endbreak";

/** Auto-logout idle window: every interaction resets it. */
const AUTO_LOGOUT_S = 5;

export function KioskScreen({ locale }: { locale: string }) {
  const t = useTranslations("kiosk");
  const { resolvedTheme, setTheme } = useTheme();
  const [session, setSession] = useState<KioskSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [stoppedMinutes, setStoppedMinutes] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [showManual, setShowManual] = useState(false);
  const [manualCardId, setManualCardId] = useState("");
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcActive, setNfcActive] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const nfcControllerRef = useRef<AbortController | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nfcStartingRef = useRef(false);
  const busyRef = useRef(false);
  const handleTapRef = useRef<(cardId: string, action?: KioskAction) => Promise<void>>(
    async () => {}
  );

  // UI-tick once a second (clock + live working minutes)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setMounted(true);
    setNfcSupported(typeof window !== "undefined" && "NDEFReader" in window);
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

  /** Auto-logout countdown; restarted after every interaction. */
  const armLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = setTimeout(() => {
      setSession(null);
      setStoppedMinutes(null);
      setErrorMsg("");
    }, AUTO_LOGOUT_S * 1000);
  }, []);

  const logout = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    setSession(null);
    setStoppedMinutes(null);
    setErrorMsg("");
  }, []);

  const handleTap = useCallback(
    async (cardId: string, action: KioskAction = "identify") => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setErrorMsg("");
      try {
        const res = await fetch("/api/kiosk/tap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId, action }),
        });
        const data = (await res.json()) as TapResponse | ErrorResponse;
        if (!res.ok) {
          const err = data as ErrorResponse;
          setErrorMsg(err.error === "card_not_found" ? t("cardNotFound") : t("scanError"));
          return;
        }
        const tap = data as TapResponse;
        if (tap.status) {
          setSession({
            cardId,
            firstName: tap.firstName,
            ...tap.status,
            fetchedAtMs: Date.now(),
          });
          armLogoutTimer();
          if (action === "stop" || tap.workedMinutes !== undefined) {
            setStoppedMinutes(tap.workedMinutes ?? null);
          }
        }
      } catch {
        setErrorMsg(t("scanError"));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [t, armLogoutTimer]
  );

  // NFC must not re-create its scan session on UI state changes (the old
  // screen re-armed on every state churn and dead-armed in the middle of a
  // fetch = "hang"). LTS-style handler ref + arm once + re-arm on visibility.
  useEffect(() => {
    handleTapRef.current = handleTap;
  }, [handleTap]);

  const armNfc = useCallback(async () => {
    if (!("NDEFReader" in window)) {
      setNfcError("not_available");
      return;
    }
    if (nfcStartingRef.current) return;
    nfcStartingRef.current = true;
    const controller = new AbortController();
    nfcControllerRef.current = controller;
    setNfcActive(true);
    setNfcError(null);
    try {
      const reader = new NDEFReader();
      await reader.scan({ signal: controller.signal });
      localStorage.setItem("kiosk-nfc-pref", "1");
      reader.onreading = (event: NDEFReadingEvent) => {
        for (const record of event.message.records) {
          if (record.recordType === "text") {
            const code = new TextDecoder().decode(record.data).trim();
            if (code) {
              void handleTapRef.current(code);
            }
            return;
          }
        }
      };
      reader.onreadingerror = () => setNfcError("scan_error");
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "InvalidStateError") {
        // Scan session already armed — not an error, keep previous one alive.
        localStorage.setItem("kiosk-nfc-pref", "1");
      } else {
        setNfcActive(false);
        localStorage.removeItem("kiosk-nfc-pref");
        if (name === "NotAllowedError") setNfcError("permission_denied");
        else if (name !== "AbortError") setNfcError("scan_error");
      }
    } finally {
      nfcStartingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const tryArm = () => {
      if (
        document.visibilityState === "visible" &&
        !nfcStartingRef.current &&
        !nfcControllerRef.current?.signal.aborted &&
        "NDEFReader" in window &&
        localStorage.getItem("kiosk-nfc-pref") === "1"
      ) {
        void armNfc();
      }
    };
    tryArm();
    document.addEventListener("visibilitychange", tryArm);
    return () => document.removeEventListener("visibilitychange", tryArm);
  }, [armNfc]);

  useEffect(() => {
    return () => {
      nfcControllerRef.current?.abort();
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  // ---- derived display values ----
  const s = session;
  const currentWorkMs = s
    ? s.active
      ? s.onBreak
        ? s.elapsedMs
        : s.elapsedMs + Math.max(0, now.getTime() - s.fetchedAtMs)
      : 0
    : 0;
  const totalTodayMs = (s?.todayWorkedMs ?? 0) + currentWorkMs;
  const todayH = Math.floor(totalTodayMs / 3_600_000);
  const todayM = Math.floor((totalTodayMs % 3_600_000) / 60_000);
  const stoppedH = stoppedMinutes != null ? Math.floor(stoppedMinutes / 60) : 0;
  const stoppedM = stoppedMinutes != null ? stoppedMinutes % 60 : 0;

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
  const hour = now.getHours();
  const greetingKey = hour < 11 ? "goodMorning" : hour < 18 ? "goodDay" : "goodEvening";

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-background p-6 text-center">
      {/* top bar: logout left (when logged in), theme toggle right */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4">
        <div>
          {s && (
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-base text-foreground shadow-sm transition hover:bg-accent"
            >
              <LogOut className="h-5 w-5" />
              {t("logoutBtn")}
            </button>
          )}
        </div>
        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm transition hover:bg-accent"
          aria-label={t("themeToggle")}
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* ---- logged-out / tap prompt ---- */}
      {!s && (
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <p className="font-mono text-5xl font-bold tabular-nums tracking-tight">{timeStr}</p>
            <p className="text-lg text-muted-foreground capitalize">{dateStr}</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              {busy ? (
                <div className="h-10 w-10 animate-pulse rounded-full bg-primary/30" />
              ) : (
                <CreditCard className="h-12 w-12 text-primary" />
              )}
            </div>
            {busy ? (
              <p className="text-2xl font-semibold">{t("loading")}</p>
            ) : nfcSupported && nfcActive ? (
              <p className="text-2xl font-semibold">{t("tapPrompt")}</p>
            ) : (
              <div className="flex flex-col items-center gap-3">
                {nfcSupported ? (
                  <button
                    onClick={armNfc}
                    className="rounded-xl bg-primary px-8 py-4 text-xl font-semibold text-primary-foreground shadow-lg transition hover:bg-primary/90 active:scale-95"
                  >
                    {t("enableNfc")}
                  </button>
                ) : (
                  <p className="text-lg text-muted-foreground">{t("nfcNotSupported")}</p>
                )}
                {nfcError === "permission_denied" && (
                  <p className="text-sm text-destructive">{t("nfcPermissionDenied")}</p>
                )}
                {nfcError === "scan_error" && (
                  <p className="text-sm text-destructive">{t("scanError")}</p>
                )}
              </div>
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
                  void handleTap(manualCardId.trim());
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
          {errorMsg && !showManual && <p className="text-lg text-destructive">{errorMsg}</p>}
          {installPrompt && !isStandalone && (
            <button
              onClick={async () => {
                if (!installPrompt) return;
                await installPrompt.prompt();
                const choice = await installPrompt.userChoice;
                if (choice.outcome === "accepted") {
                  setInstallPrompt(null);
                  setIsStandalone(true);
                }
              }}
              className="flex items-center gap-2 rounded-xl border-2 border-primary px-6 py-3 text-base font-semibold text-primary transition hover:bg-primary/5 active:scale-95"
            >
              <Download className="h-5 w-5" />
              {t("installApp")}
            </button>
          )}
        </div>
      )}

      {/* ---- logged in: employee session ---- */}
      {s && (
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-4xl font-bold">{t(greetingKey, { name: s.firstName })}</h1>

          <div className="flex flex-col items-center gap-1">
            <p
              className={`text-xl font-semibold ${s.onBreak ? "text-yellow-600" : s.active ? "text-emerald-600" : "text-muted-foreground"}`}
            >
              {s.onBreak ? t("breakLabel") : s.active ? t("runningLabel") : t("idleLabel")}
            </p>
            <p className="font-mono text-5xl font-bold tabular-nums tracking-tight">
              {todayH}h {String(todayM).padStart(2, "0")}min
            </p>
            <p className="text-sm text-muted-foreground">{t("todayLabel")}</p>
          </div>

          <div className="mt-2 flex flex-col items-center gap-3">
            <button
              onClick={() => void handleTap(s.cardId, s.active ? "stop" : "start")}
              disabled={busy}
              className={`flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-3xl text-2xl font-bold text-primary-foreground shadow-xl transition active:scale-95 disabled:opacity-50 ${
                s.active ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {s.active ? <Square className="h-12 w-12" /> : <Play className="h-12 w-12" />}
              {s.active ? t("stopBtn") : t("startBtn")}
            </button>
            <button
              onClick={() => void handleTap(s.cardId, s.onBreak ? "endbreak" : "break")}
              disabled={busy || !s.active}
              className="flex items-center gap-3 rounded-2xl bg-secondary px-10 py-5 text-xl font-semibold text-secondary-foreground shadow-md transition hover:bg-secondary/80 active:scale-95 disabled:opacity-40"
            >
              <Coffee className="h-7 w-7" />
              {s.onBreak ? t("breakEndBtn") : t("breakBtn")}
            </button>
          </div>

          {stoppedMinutes != null && !s.active && (
            <p className="text-lg text-emerald-600">
              {t("stoppedSummary", { hours: stoppedH, minutes: String(stoppedM).padStart(2, "0") })}
            </p>
          )}
          {errorMsg && <p className="text-destructive">{errorMsg}</p>}
        </div>
      )}
    </div>
  );
}

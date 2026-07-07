"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Play, Square, CheckCircle2, XCircle, CreditCard } from "lucide-react";

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

export function KioskScreen({ locale }: { locale: string }) {
  const t = useTranslations("kiosk");
  const [state, setState] = useState<KioskState>("idle");
  const [userName, setUserName] = useState("");
  const [workedMinutes, setWorkedMinutes] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [showManual, setShowManual] = useState(false);
  const [manualCardId, setManualCardId] = useState("");
  const nfcRef = useRef<any>(null);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleCardTap = useCallback(async (cardId: string) => {
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
        setErrorMsg(
          err.error === "card_not_found"
            ? t("cardNotFound")
            : err.error === "rate_limited"
            ? t("rateLimited")
            : t("scanError")
        );
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
  }, [state, t, scheduleRevert]);

  useEffect(() => {
    if (state !== "idle") return;

    async function startNfc() {
      if (!("NDEFReader" in navigator)) return;
      try {
        const reader = new (window as any).NDEFReader();
        await reader.scan();
        nfcRef.current = reader;
        reader.addEventListener("reading", (event: any) => {
          for (const record of event.message.records) {
            if (record.recordType === "text") {
              const text = record.data.getRecordText?.() ?? "";
              if (text.trim()) {
                handleCardTap(text.trim());
              }
            }
          }
        });
      } catch {
        // NFC permission denied or not available
      }
    }

    startNfc();

    return () => {
      if (nfcRef.current) {
        nfcRef.current = null;
      }
    };
  }, [state, handleCardTap]);

  const localeStr = locale === "en" ? "en-US" : "de-DE";
  const timeStr = now.toLocaleTimeString(localeStr, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString(localeStr, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

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
            <p className="text-2xl font-semibold">{t("tapPrompt")}</p>
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
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-lg font-semibold text-primary-foreground">
                OK
              </button>
            </form>
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
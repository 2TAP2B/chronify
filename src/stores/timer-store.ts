"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { useLocale } from "next-intl";
import { formatDuration } from "@/lib/timer-utils";
import { computeElapsedMs, computeBreakMs, type TimerState } from "@/lib/timer-utils";
import { checkMaxDailyHours, checkRestPeriod, type ArbzgWarning } from "@/lib/arbzg";
import { arbzgWarningText } from "@/lib/notifications/server-texts";

export type TimerStatus = {
  active: boolean;
  onBreak: boolean;
  startedAt: string | null;
  breakStartedAt: string | null;
  elapsedMs: number;
  breakMs: number;
  todayWorkedMs: number;
  lastWorkEndAt: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type TimerStore = {
  status: TimerStatus | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  tick: number;
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  toggleBreak: () => Promise<void>;
};

let tickInterval: ReturnType<typeof setInterval> | null = null;

function startTicking(fire: () => void) {
  if (tickInterval) return;
  tickInterval = setInterval(fire, 1000);
}

function stopTicking() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function computeLive(status: TimerStatus | null): { elapsedMs: number; breakMs: number } {
  if (!status || !status.active || !status.startedAt) {
    return { elapsedMs: status?.elapsedMs ?? 0, breakMs: status?.breakMs ?? 0 };
  }
  const now = Date.now();
  const startedAtMs = new Date(status.startedAt).getTime();
  const totalElapsed = Math.max(0, now - startedAtMs);
  const runningBreak =
    status.onBreak && status.breakStartedAt
      ? Math.max(0, now - new Date(status.breakStartedAt).getTime())
      : 0;
  const totalBreak = status.breakMs + runningBreak;
  return { elapsedMs: Math.max(0, totalElapsed - totalBreak), breakMs: totalBreak };
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  status: null,
  loaded: false,
  loading: true,
  error: null,
  tick: 0,

  refresh: async () => {
    try {
      const s = await fetchJson<TimerStatus>("/api/timer");
      set({ status: s, loaded: true, loading: false, error: null });
      if (s.active) {
        startTicking(() => set((st) => ({ tick: st.tick + 1 })));
      } else {
        stopTicking();
      }
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "error",
        loading: false,
        loaded: true,
      });
    }
  },

  start: async () => {
    set({ loading: true });
    try {
      await fetchJson("/api/timer/start", { method: "POST" });
      await get().refresh();
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "error",
        loading: false,
      });
    }
  },

  stop: async () => {
    set({ loading: true });
    try {
      await fetchJson("/api/timer/stop", { method: "POST" });
      await get().refresh();
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "error",
        loading: false,
      });
    }
  },

  toggleBreak: async () => {
    const { status } = get();
    if (!status) return;
    const action = status.onBreak ? "end" : "start";
    set({ loading: true });
    try {
      await fetchJson("/api/timer/break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await get().refresh();
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "error",
        loading: false,
      });
    }
  },
}));

export function useTimer() {
  const { status, loaded, loading, error, tick, refresh, start, stop, toggleBreak } =
    useTimerStore();

  const live = computeLive(status);

  const todayWorkedMs = status?.todayWorkedMs ?? 0;
  const active = status?.active ?? false;
  const displayElapsedMs = active ? live.elapsedMs : 0;
  const totalWorkedMs = active ? todayWorkedMs + live.elapsedMs : todayWorkedMs;

  useArbzgNotifications({ active, totalWorkedMs, lastWorkEndAt: status?.lastWorkEndAt ?? null });

  return {
    status,
    loaded,
    loading,
    error,
    tick,
    active,
    onBreak: status?.onBreak ?? false,
    displayElapsedMs,
    displayBreakMs: live.breakMs,
    displayElapsed: formatDuration(live.elapsedMs),
    displayBreak: formatDuration(live.breakMs),
    todayWorkedMs,
    totalWorkedMs,
    totalWorkedDisplay: formatDuration(totalWorkedMs),
    start,
    stop,
    toggleBreak,
    refresh,
  };
}

export function useTimerInit() {
  const refresh = useTimerStore((s) => s.refresh);
  const loaded = useTimerStore((s) => s.loaded);
  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded, refresh]);
}

function useArbzgNotifications(opts: {
  active: boolean;
  totalWorkedMs: number;
  lastWorkEndAt: string | null;
}) {
  const notifiedRef = useRef<Set<string>>(new Set());
  const locale = useLocale() === "en" ? "en" : "de";

  useEffect(() => {
    const checks: Array<ArbzgWarning | null> = [
      opts.active || opts.totalWorkedMs > 0 ? checkMaxDailyHours(opts.totalWorkedMs) : null,
      !opts.active && opts.lastWorkEndAt ? checkRestPeriod(opts.lastWorkEndAt) : null,
    ];

    for (const w of checks) {
      if (!w) continue;
      const warningKey = w.key;
      if (notifiedRef.current.has(warningKey)) continue;
      notifiedRef.current.add(warningKey);

      const text = arbzgWarningText(warningKey, locale) ?? {
        title: warningKey,
        body: "",
      };

      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "GENERIC",
          title: text.title,
          body: text.body,
          payload: { category: "arbzg", warningKey },
        }),
      }).catch(() => {});
    }
    // `locale` is intentionally excluded: re-running on a language switch
    // would re-post already surfaced warnings under the new locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.active, opts.totalWorkedMs, opts.lastWorkEndAt]);
}

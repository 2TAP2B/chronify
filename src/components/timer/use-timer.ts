"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { formatDuration } from "@/lib/timer-utils";

export type TimerStatus = {
  active: boolean;
  onBreak: boolean;
  startedAt: string | null;
  breakStartedAt: string | null;
  elapsedMs: number;
  breakMs: number;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
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

export function useTimer() {
  const [status, setStatus] = useState<TimerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await fetchJson<TimerStatus>("/api/timer");
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status?.active) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status?.active]);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      await fetchJson("/api/timer/start", { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      setLoading(false);
    }
  }, [refresh]);

  const stop = useCallback(async () => {
    setLoading(true);
    try {
      await fetchJson("/api/timer/stop", { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      setLoading(false);
    }
  }, [refresh]);

  const toggleBreak = useCallback(async () => {
    if (!status) return;
    const action = status.onBreak ? "end" : "start";
    setLoading(true);
    try {
      await fetchJson("/api/timer/break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      setLoading(false);
    }
  }, [refresh, status]);

  const live = computeLive(status);

  return {
    status,
    loading,
    error,
    displayElapsedMs: live.elapsedMs,
    displayBreakMs: live.breakMs,
    displayElapsed: formatDuration(live.elapsedMs),
    displayBreak: formatDuration(live.breakMs),
    start,
    stop,
    toggleBreak,
    refresh,
  };
}

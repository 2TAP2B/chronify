import type { TimerSession } from "@prisma/client";

export type TimerState = {
  startedAt: number;
  lastTickAt: number;
  breakStartedAt: number | null;
  accumulatedBreakMs: number;
};

export function toTimerState(s: TimerSession): TimerState {
  return {
    startedAt: s.startedAt.getTime(),
    lastTickAt: s.lastTickAt.getTime(),
    breakStartedAt: s.breakStartedAt ? s.breakStartedAt.getTime() : null,
    accumulatedBreakMs: s.accumulatedBreakMs,
  };
}

export function computeElapsedMs(state: TimerState, now: number): number {
  const onBreakMs =
    state.breakStartedAt != null ? Math.max(0, now - state.breakStartedAt) : 0;
  const totalBreakMs = state.accumulatedBreakMs + onBreakMs;
  return Math.max(0, now - state.startedAt - totalBreakMs);
}

export function computeWorkedMs(state: TimerState, now: number): number {
  return computeElapsedMs(state, now);
}

export function computeBreakMs(state: TimerState, now: number): number {
  const onBreakMs =
    state.breakStartedAt != null ? Math.max(0, now - state.breakStartedAt) : 0;
  return state.accumulatedBreakMs + onBreakMs;
}

export function isOnBreak(state: TimerState): boolean {
  return state.breakStartedAt != null;
}

export function msToMinutes(ms: number): number {
  return Math.round(ms / 60_000);
}

export function msToHours(ms: number): number {
  return ms / 3_600_000;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}`;
}

export function isEntryLocked(
  entryDate: Date,
  lockWindowDays: number,
  now: Date = new Date()
): boolean {
  const ageMs = now.getTime() - entryDate.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  return ageDays > lockWindowDays;
}

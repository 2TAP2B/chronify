import type { BreakModel } from "./breaks";

export type WorkingModelMinutes = {
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  weeklyTargetMinutes: number;
};

export const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export function targetMinutesForDate(date: Date, model: WorkingModelMinutes): number {
  const weekday = date.getUTCDay();
  switch (weekday) {
    case 0: return model.sundayMinutes;
    case 1: return model.mondayMinutes;
    case 2: return model.tuesdayMinutes;
    case 3: return model.wednesdayMinutes;
    case 4: return model.thursdayMinutes;
    case 5: return model.fridayMinutes;
    case 6: return model.saturdayMinutes;
    default: return 0;
  }
}

export type DaySummary = {
  date: Date;
  workedMs: number;
  breakMinutes: number;
  targetMinutes: number;
  deltaMs: number;
};

export function computeDailyDelta(workedMs: number, targetMinutes: number): number {
  const workedMin = Math.floor(workedMs / 60_000);
  return (workedMin - targetMinutes) * 60_000;
}

export function summarizeDay(opts: {
  date: Date;
  workedMs: number;
  breakMinutes: number;
  model: WorkingModelMinutes;
}): DaySummary {
  const target = targetMinutesForDate(opts.date, opts.model);
  const delta = computeDailyDelta(opts.workedMs, target);
  return {
    date: opts.date,
    workedMs: opts.workedMs,
    breakMinutes: opts.breakMinutes,
    targetMinutes: target,
    deltaMs: delta,
  };
}

export function sumDeltaMs(days: DaySummary[]): number {
  return days.reduce((sum, d) => sum + d.deltaMs, 0);
}

export function msToSignedHours(ms: number): number {
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export function msToSignedMinutes(ms: number): number {
  return Math.round(ms / 60_000);
}

export function formatSignedDuration(ms: number): string {
  const totalMin = msToSignedMinutes(ms);
  const sign = totalMin < 0 ? "-" : "+";
  const abs = Math.abs(totalMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${sign}${pad(h)}:${pad(m)}`;
}

export function carryoverCutoffDate(
  year: number,
  month: number,
  day: number
): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function isAfterCarryoverCutoff(date: Date, cutoff: Date): boolean {
  return date.getTime() >= cutoff.getTime();
}

export type OvertimeComputation = {
  year: number;
  totalDeltaMs: number;
  carriedOverMinutes: number;
  balanceMs: number;
  byMonth: { month: number; deltaMs: number }[];
};

export function computeOvertimeForYear(opts: {
  year: number;
  days: DaySummary[];
  carriedOverMinutes: number;
}): OvertimeComputation {
  const byMonth: { month: number; deltaMs: number }[] = Array.from(
    { length: 12 },
    (_, i) => ({ month: i + 1, deltaMs: 0 })
  );
  let totalDeltaMs = 0;
  for (const d of opts.days) {
    const m = d.date.getUTCMonth() + 1;
    byMonth[m - 1].deltaMs += d.deltaMs;
    totalDeltaMs += d.deltaMs;
  }
  const carriedMs = opts.carriedOverMinutes * 60_000;
  const balanceMs = totalDeltaMs + carriedMs;
  return {
    year: opts.year,
    totalDeltaMs,
    carriedOverMinutes: opts.carriedOverMinutes,
    balanceMs,
    byMonth,
  };
}

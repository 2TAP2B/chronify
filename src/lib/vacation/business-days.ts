import { addDaysUtc, toCalendarDate } from "@/lib/datetime";
import { targetMinutesForDate } from "@/lib/overtime/calculate";
import type { PublicHoliday, FederalState } from "@prisma/client";

export type HolidayResolver = (date: Date, state: FederalState) => PublicHoliday | null;

export function makeHolidayResolver(holidays: PublicHoliday[]): HolidayResolver {
  const byDateState = new Map<string, PublicHoliday>();
  const globalByDate = new Map<string, PublicHoliday>();
  const manualByDateState = new Map<string, PublicHoliday>();

  function setManual(entry: PublicHoliday) {
    const key = holidayKey(entry.date, entry.federalState);
    manualByDateState.set(key, entry);
  }
  function setGlobal(entry: PublicHoliday) {
    const key = holidayKey(entry.date, entry.federalState);
    if (!globalByDate.has(key)) globalByDate.set(key, entry);
  }
  function setCounty(entry: PublicHoliday) {
    const key = holidayKey(entry.date, entry.federalState);
    if (!byDateState.has(key)) byDateState.set(key, entry);
  }

  for (const h of holidays) {
    const key = holidayKey(h.date, h.federalState);
    if (h.source === "MANUAL") {
      manualByDateState.set(key, h);
      continue;
    }
    if (h.counties.length === 0) {
      if (!globalByDate.has(key)) globalByDate.set(key, h);
    } else {
      if (!byDateState.has(key)) byDateState.set(key, h);
    }
  }

  return (date: Date, state: FederalState): PublicHoliday | null => {
    const key = holidayKey(date, state);
    // Manual always wins.
    const manual = manualByDateState.get(key);
    if (manual) return manual;
    // County-level (NAGER) beats global.
    const stateHoliday = byDateState.get(key);
    if (stateHoliday) return stateHoliday;
    return globalByDate.get(key) ?? null;
  };
}

function holidayKey(date: Date, state: FederalState): string {
  const d = toCalendarDate(date, "UTC");
  return `${d.toISOString().slice(0, 10)}|${state}`;
}

export function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

export function isBusinessDay(date: Date, state: FederalState, resolver: HolidayResolver): boolean {
  if (isWeekend(date)) return false;
  if (resolver(date, state)) return false;
  return true;
}

export type BusinessDayResult = {
  businessDays: Date[];
  totalDays: number;
  holidayCount: number;
  weekendCount: number;
};

export function businessDaysInRange(
  from: Date,
  to: Date,
  state: FederalState,
  resolver: HolidayResolver
): BusinessDayResult {
  if (from.getTime() > to.getTime()) {
    return { businessDays: [], totalDays: 0, holidayCount: 0, weekendCount: 0 };
  }
  const days: Date[] = [];
  let weekendCount = 0;
  let holidayCount = 0;
  let cursor = toCalendarDate(from, "UTC");
  const end = toCalendarDate(to, "UTC");
  while (cursor.getTime() <= end.getTime()) {
    if (isWeekend(cursor)) {
      weekendCount++;
    } else if (resolver(cursor, state)) {
      holidayCount++;
    } else {
      days.push(cursor);
    }
    cursor = addDaysUtc(cursor, 1);
  }
  return {
    businessDays: days,
    totalDays: days.length + weekendCount + holidayCount,
    holidayCount,
    weekendCount,
  };
}

export function overlapsExisting(
  newFrom: Date,
  newTo: Date,
  existing: { from: Date; to: Date; status: string }[]
): boolean {
  for (const e of existing) {
    if (e.status === "REJECTED" || e.status === "CANCELLED") continue;
    if (newFrom.getTime() <= e.to.getTime() && newTo.getTime() >= e.from.getTime()) {
      return true;
    }
  }
  return false;
}

export type ModelRange = {
  validFrom: Date;
  validTo: null | Date;
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  weeklyTargetMinutes: number;
  halfDayMinutes?: number | null;
};

export function modelForDate(models: ModelRange[], date: Date): ModelRange | null {
  return (
    models.find((m) => m.validFrom <= date && (m.validTo == null || m.validTo >= date)) ?? null
  );
}

/**
 * Days with target = 0 in the working model (e.g. 4-day week) consume no
 * vacation day. No models at all -> status quo: all days consume.
 */
export function splitByWorkTarget(
  days: Date[],
  models: ModelRange[] | null
): { consumed: Date[]; skipped: Date[] } {
  if (!models || models.length === 0) return { consumed: days, skipped: [] };
  const consumed: Date[] = [];
  const skipped: Date[] = [];
  for (const d of days) {
    const m = modelForDate(models, d);
    if (m && targetMinutesForDate(d, m) === 0) skipped.push(d);
    else consumed.push(d);
  }
  return { consumed, skipped };
}

/** Org toggle today: 24.12 and/or 31.12 count as half vacation days, every year. */
export function halfDayDateSet(settings: {
  heiligabendHalfDay?: boolean;
  silvesterHalfDay?: boolean;
}): Set<string> {
  const set = new Set<string>();
  if (settings.heiligabendHalfDay) set.add("12-24");
  if (settings.silvesterHalfDay) set.add("12-31");
  return set;
}

/** Weight of a vacation day: 0.5 on configured half days (MM-DD), else 1. */
export function vacationWeight(date: Date, halfDays: Set<string>): number {
  const iso = toCalendarDate(date, "UTC").toISOString().slice(0, 10);
  return halfDays.has(iso.slice(5)) ? 0.5 : 1;
}

/** Sum of vacation weights over consumed days. */
export function consumedDaysOf(days: Date[], halfDays: Set<string>): number {
  return days.reduce((sum, d) => sum + vacationWeight(d, halfDays), 0);
}

/**
 * Overtime minutes charged for a half vacation day: explicit model value or
 * half of that weekday's target.
 */
export function halfDayMinutesFor(model: ModelRange, date: Date): number {
  const target = targetMinutesForDate(date, model);
  return model.halfDayMinutes ?? Math.floor(target / 2);
}

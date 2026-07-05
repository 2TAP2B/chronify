import { addDaysUtc, toCalendarDate } from "@/lib/datetime";
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

export function isBusinessDay(
  date: Date,
  state: FederalState,
  resolver: HolidayResolver
): boolean {
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

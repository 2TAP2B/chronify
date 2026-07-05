import { format as fnsFormat } from "date-fns";
import { de as deLocale, enUS } from "date-fns/locale";

export type Locale2 = "de" | "en";

const localeMap = { de: deLocale, en: enUS } as const;

export function dateFnsLocale(locale: Locale2) {
  return localeMap[locale] ?? deLocale;
}

export function toCalendarDate(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")!.value);
  return new Date(Date.UTC(y, m, d));
}

export function startOfDayUtc(instant: Date, timeZone: string): Date {
  return toCalendarDate(instant, timeZone);
}

export function startOfWeekUtc(instant: Date, timeZone: string): Date {
  const day = toCalendarDate(instant, timeZone);
  const weekday = day.getUTCDay();
  const diff = (weekday + 6) % 7;
  const monday = new Date(day);
  monday.setUTCDate(day.getUTCDate() - diff);
  return monday;
}

export function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function isSameCalendarDay(a: Date, b: Date, timeZone: string): boolean {
  return toCalendarDate(a, timeZone).getTime() === toCalendarDate(b, timeZone).getTime();
}

export function formatInZone(
  instant: Date,
  timeZone: string,
  fmt: string,
  locale: Locale2 = "de"
): string {
  const zoned = utcToZonedTime(instant, timeZone);
  return fnsFormat(zoned, fmt, { locale: dateFnsLocale(locale) });
}

export function utcToZonedTime(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const y = get("year");
  const m = get("month") - 1;
  const d = get("day");
  let h = get("hour");
  if (h === 24) h = 0;
  const min = get("minute");
  const sec = get("second");
  const targetWallAsUtc = Date.UTC(y, m, d, h, min, sec);
  const hostOffsetMs = new Date().getTimezoneOffset() * -60_000;
  return new Date(targetWallAsUtc - hostOffsetMs);
}

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

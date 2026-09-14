export type ReportAutomationFrequencyValue = "WEEKLY" | "MONTHLY";

export type AutomationPeriod = {
  periodKey: string;
  from: Date;
  to: Date;
};

const DAY_MS = 86_400_000;

function isoWeekNumber(utcDate: Date): number {
  const d = new Date(
    Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

function isoWeekYear(utcDate: Date): number {
  const d = new Date(
    Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

function isoWeekStart(dateUtc: Date): Date {
  const weekday = dateUtc.getUTCDay() || 7;
  return new Date(dateUtc.getTime() - (weekday - 1) * DAY_MS);
}

/**
 * Period covered by an automated report relative to `ref` (both on UTC
 * calendar-day granularity): the calendar week (Mon–Sun) or the month
 * directly before the ref's calendar week/month.
 */
export function computePeriod(
  frequency: ReportAutomationFrequencyValue,
  ref: Date
): AutomationPeriod {
  const today = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));

  if (frequency === "WEEKLY") {
    const thisWeekMonday = isoWeekStart(today);
    const lastWeekMonday = new Date(thisWeekMonday.getTime() - 7 * DAY_MS);
    const year = isoWeekYear(lastWeekMonday);
    const week = isoWeekNumber(lastWeekMonday);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      periodKey: `${year}-W${pad(week)}`,
      // covers lastWeekMonday 00:00 UTC until (exclusive) thisWeekMonday
      from: lastWeekMonday,
      to: thisWeekMonday,
    };
  }

  const lastMonthIndex = today.getUTCMonth() - 1;
  return {
    periodKey: `${lastMonthIndex < 0 ? today.getUTCFullYear() - 1 : today.getUTCFullYear()}-${String(
      ((lastMonthIndex + 12) % 12) + 1
    ).padStart(2, "0")}`,
    from: new Date(
      Date.UTC(
        lastMonthIndex < 0 ? today.getUTCFullYear() - 1 : today.getUTCFullYear(),
        (lastMonthIndex + 12) % 12,
        1
      )
    ),
    to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
  };
}

const FILE_NAME_SAFE = /^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/;

/** Lowercase ASCII slug with `-` separators, safe to embed in file names. */
export function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "unbekannt";
}

export function buildReportFileName(opts: { userName: string; periodKey: string }): string {
  return `stundenzettel_${slugifyName(opts.userName)}_${opts.periodKey}.pdf`;
}

const SUBFOLDER_ALLOWED = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;

/** Rejects traversal (no `..`, no absolute paths, no trailing slash). */
export function isSafeSubfolder(subfolder: string): boolean {
  return subfolder === "" || SUBFOLDER_ALLOWED.test(subfolder);
}

export type ScheduleDueConfig = {
  frequency: ReportAutomationFrequencyValue;
  weeklyDay: number;
  monthlyDay: number;
  runHour: number;
};

/**
 * Time-based decision (on the Europe/Berlin calendar): a scheduled run is due
 * once the configured hour has passed on the configured weekday/month day —
 * or on any later day inside the *same* period, so the app can catch up after
 * downtime. Whether the period was already produced is checked separately via
 * ReportAutomationRun; the (kind, periodKey) uniqueness keeps catch-up runs
 * idempotent.
 */
export function isScheduledDue(config: ScheduleDueConfig, now: Date): boolean {
  const berlinParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const partOf = (type: string) => berlinParts.find((p) => p.type === type)!.value;
  const weekdayName = partOf("weekday");
  const day = Number(partOf("day"));
  const hour = Number(partOf("hour"));

  if (config.frequency === "WEEKLY") {
    const isoDay = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekdayName) + 1;
    return isoDay === config.weeklyDay ? hour >= config.runHour : isoDay > config.weeklyDay;
  }
  // MONTHLY: clamp the configured day to the month length (day 31 → Feb 28).
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dueDay = Math.min(config.monthlyDay, lastDay);
  return day === dueDay ? hour >= config.runHour : day > dueDay;
}

import { db } from "@/lib/db";
import { isSameCalendarDay } from "@/lib/datetime";
import { targetMinutesForDate } from "@/lib/overtime/calculate";
import {
  CLOSURE_NOTE_PREFIX,
  businessDaysInRange,
  halfDayMinutesFor,
  makeHolidayResolver,
  modelForDate,
  splitByWorkTarget,
  vacationWeight,
} from "@/lib/vacation/business-days";
import { trackingStartYear } from "@/server/services/overtime";
import type { FederalState } from "@prisma/client";

/** Extra vacation days per year for users with regeneration leave enabled. */
export const REGENERATION_EXTRA_DAYS = 2;

/**
 * Serializes balance check + booking per user (Postgres advisory lock held for
 * the duration of `fn`), so two concurrent approvals/requests/choice switches
 * can't both pass the same headroom check. `fn` uses `db` normally; its writes
 * are committed before the lock is released.
 */
export async function withLeaveLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      return fn();
    },
    { maxWait: 30_000, timeout: 60_000 }
  );
}

export function workingModelsInRange(userId: string, from: Date, to: Date) {
  return db.workingModel.findMany({
    where: {
      userId,
      validFrom: { lte: to },
      OR: [{ validTo: null }, { validTo: { gte: from } }],
    },
    orderBy: { validFrom: "desc" },
  });
}

/** Days (yyyy-mm-dd) in [from, to] the user already has as closure vacation. */
export async function closureDayKeys(userId: string, from: Date, to: Date): Promise<Set<string>> {
  const entries = await db.timeEntry.findMany({
    where: {
      userId,
      type: "VACATION",
      note: { startsWith: CLOSURE_NOTE_PREFIX },
      date: { gte: from, lte: to },
    },
    select: { date: true },
  });
  return new Set(entries.map((e) => e.date.toISOString().slice(0, 10)));
}

export type LeaveCharge = {
  /** Days that get a VACATION entry (working days, no holiday, not closure-owned). */
  spendableDays: Date[];
  /** Vacation days charged when paid from the entitlement. */
  days: number;
  /** Overtime minutes charged when paid from overtime. */
  minutes: number;
  /** Per spendable day: vacation-day weight and overtime minutes. */
  dayCharges: { date: Date; days: number; minutes: number }[];
  totalDays: number;
  holidayCount: number;
  weekendCount: number;
  zeroTargetCount: number;
};

/**
 * What a leave request over [from, to] costs this user: only days with a
 * target in their working model, no holidays of their state, nothing a
 * business closure already covers. Half days (halfDay request or configured
 * 24.12/31.12) weigh 0.5 / the model's half-day minutes.
 */
export async function computeLeaveCharge(opts: {
  userId: string;
  from: Date;
  to: Date;
  halfDay: boolean;
  state: FederalState;
  timeZone: string;
  halfDays: Set<string>;
}): Promise<LeaveCharge> {
  const { userId, from, to, timeZone } = opts;
  const [holidays, models, closureDays] = await Promise.all([
    db.publicHoliday.findMany({
      where: { federalState: opts.state, date: { gte: from, lte: to } },
    }),
    workingModelsInRange(userId, from, to),
    closureDayKeys(userId, from, to),
  ]);
  const range = businessDaysInRange(from, to, opts.state, makeHolidayResolver(holidays));
  const open = range.businessDays.filter((d) => !closureDays.has(d.toISOString().slice(0, 10)));
  const { consumed: spendableDays, skipped } = splitByWorkTarget(open, models);

  const halfDayRequest = opts.halfDay && isSameCalendarDay(from, to, timeZone);
  const dayCharges = spendableDays.map((d) => {
    const weight =
      halfDayRequest && isSameCalendarDay(from, d, timeZone)
        ? 0.5
        : vacationWeight(d, opts.halfDays);
    const model = modelForDate(models, d);
    const minutes = !model
      ? 0
      : weight === 0.5
        ? halfDayMinutesFor(model, d)
        : targetMinutesForDate(d, model);
    return { date: d, days: weight, minutes };
  });
  return {
    spendableDays,
    days: dayCharges.reduce((sum, c) => sum + c.days, 0),
    minutes: dayCharges.reduce((sum, c) => sum + c.minutes, 0),
    dayCharges,
    totalDays: range.totalDays,
    holidayCount: range.holidayCount,
    weekendCount: range.weekendCount,
    zeroTargetCount: skipped.length,
  };
}

/** Base entitlement for a year: its own row, else the latest earlier row (contract carries on), else the org default. */
export async function inheritedTotalDays(userId: string, year: number): Promise<number> {
  const row = await db.vacationEntitlement.findFirst({
    where: { userId, year: { lte: year } },
    orderBy: { year: "desc" },
    select: { totalDays: true },
  });
  if (row) return row.totalDays;
  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  return settings.defaultVacationDays;
}

export type VacationAccount = {
  year: number;
  /** Contract days for the year (without regeneration). */
  baseTotalDays: number;
  regenerationDays: number;
  carriedOverDays: number;
  /** Carryover is the previous year's live remainder (not stored, never expires). */
  carryIsAuto: boolean;
  consumedDays: number;
  availableDays: number;
};

/**
 * Vacation account for one year. Unused days of the previous year always carry
 * over in full (computed live), so nothing is lost at the year change and late
 * corrections in the old year flow into the new one.
 */
export async function vacationAccount(userId: string, year: number): Promise<VacationAccount> {
  const [startYearOrNull, user, rows, settings] = await Promise.all([
    trackingStartYear(userId),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { regeneration: true } }),
    db.vacationEntitlement.findMany({
      where: { userId, year: { lte: year } },
      orderBy: { year: "asc" },
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);
  const startYear = Math.min(startYearOrNull ?? year, year);
  const regenerationDays = user.regeneration ? REGENERATION_EXTRA_DAYS : 0;
  const rowByYear = new Map(rows.map((r) => [r.year, r]));
  // Contract days carry forward from the latest earlier row, else org default.
  let baseTotalDays = settings.defaultVacationDays;
  for (const r of rows) if (r.year < startYear) baseTotalDays = r.totalDays;

  // One pass from the start year: each year's remainder is the next year's carryover.
  let carriedOverDays = rowByYear.get(startYear)?.carriedOverDays ?? 0;
  for (let y = startYear; ; y++) {
    const row = rowByYear.get(y);
    if (row) baseTotalDays = row.totalDays;
    const consumedDays = row?.consumedDays ?? 0;
    const availableDays = baseTotalDays + regenerationDays + carriedOverDays - consumedDays;
    if (y === year) {
      return {
        year,
        baseTotalDays,
        regenerationDays,
        carriedOverDays,
        carryIsAuto: y > startYear,
        consumedDays,
        availableDays,
      };
    }
    carriedOverDays = availableDays;
  }
}

/**
 * Vacation days still available for new leave in `year`. Pending (non-overtime)
 * requests count as reserved unless `includePending` is false (approval
 * re-checks against approved state only). Overtime has no such limit — it may
 * go negative.
 */
export async function vacationHeadroom(opts: {
  userId: string;
  year: number;
  includePending: boolean;
}): Promise<number> {
  const account = await vacationAccount(opts.userId, opts.year);
  if (!opts.includePending) return account.availableDays;
  const pending = await db.vacationRequest.aggregate({
    where: { userId: opts.userId, year: opts.year, status: "PENDING", useOvertime: false },
    _sum: { days: true },
  });
  return account.availableDays - (pending._sum.days ?? 0);
}

/** Ensures the year's entitlement row exists (inherited contract days) before increments. */
export async function ensureEntitlement(userId: string, year: number): Promise<void> {
  const existing = await db.vacationEntitlement.findUnique({
    where: { userId_year: { userId, year } },
  });
  if (existing) return;
  await db.vacationEntitlement.upsert({
    where: { userId_year: { userId, year } },
    create: { userId, year, totalDays: await inheritedTotalDays(userId, year) },
    update: {},
  });
}

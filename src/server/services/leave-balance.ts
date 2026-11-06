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
import { computeYearOvertime } from "@/server/services/overtime";
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
  let days = 0;
  let minutes = 0;
  for (const d of spendableDays) {
    const weight =
      halfDayRequest && isSameCalendarDay(from, d, timeZone)
        ? 0.5
        : vacationWeight(d, opts.halfDays);
    days += weight;
    const model = modelForDate(models, d);
    if (model) {
      minutes += weight === 0.5 ? halfDayMinutesFor(model, d) : targetMinutesForDate(d, model);
    }
  }
  return {
    spendableDays,
    days,
    minutes,
    totalDays: range.totalDays,
    holidayCount: range.holidayCount,
    weekendCount: range.weekendCount,
    zeroTargetCount: skipped.length,
  };
}

/**
 * Vacation days and overtime minutes still available for new leave in `year`.
 * Pending requests count as reserved unless `includePending` is false (approval
 * re-checks against approved state only).
 */
export async function leaveHeadroom(opts: {
  userId: string;
  year: number;
  state: FederalState;
  timeZone: string;
  halfDays: Set<string>;
  includePending: boolean;
}): Promise<{ vacationDays: number; overtimeMinutes: number }> {
  const { userId, year } = opts;
  const [user, entitlement, settings, overtime, pending] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { regeneration: true } }),
    db.vacationEntitlement.findUnique({ where: { userId_year: { userId, year } } }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    computeYearOvertime({ userId, year, timeZone: opts.timeZone }),
    opts.includePending
      ? db.vacationRequest.findMany({
          where: { userId, year, status: "PENDING" },
        })
      : Promise.resolve([]),
  ]);

  let vacationDays =
    (entitlement?.totalDays ?? settings.defaultVacationDays) +
    (user.regeneration ? REGENERATION_EXTRA_DAYS : 0) +
    (entitlement?.carriedOverDays ?? 0) -
    (entitlement?.consumedDays ?? 0);
  let overtimeMinutes = Math.round(overtime.computation.balanceMs / 60_000);

  for (const r of pending) {
    if (!r.useOvertime) {
      vacationDays -= r.days;
      continue;
    }
    const charge = await computeLeaveCharge({
      userId,
      from: r.from,
      to: r.to,
      halfDay: r.halfDay,
      state: opts.state,
      timeZone: opts.timeZone,
      halfDays: opts.halfDays,
    });
    overtimeMinutes -= charge.minutes;
  }
  return { vacationDays, overtimeMinutes };
}

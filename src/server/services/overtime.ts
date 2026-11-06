import { db } from "@/lib/db";
import { getUserContext, type SessionUser } from "@/server/context";
import { getActiveWorkingModel } from "@/server/services/timer";
import {
  computeOvertimeForYear,
  summarizeDay,
  targetMinutesForDate,
  carryoverCutoffDate,
  formatSignedDuration,
  msToSignedHours,
  type OvertimeComputation,
  type DaySummary,
} from "@/lib/overtime/calculate";
import { toCalendarDate, addDaysUtc } from "@/lib/datetime";
import { DAY_KEYS, type DayKey } from "@/lib/overtime/calculate";
import {
  CLOSURE_NOTE_PREFIX,
  halfDayMinutesFor,
  halfDayDateSet,
} from "@/lib/vacation/business-days";
import type { WorkingModel } from "@prisma/client";

/** Working-model field key (e.g. "mondayMinutes") for a UTC date. */
function dayKeyForDate(date: Date): `${(typeof DAY_KEYS)[number]}Minutes` {
  return `${DAY_KEYS[date.getUTCDay()]}Minutes`;
}

export type DaySummaryWithMeta = DaySummary & {
  hasTimerEntry: boolean;
};

export function workedMsFromEntry(e: {
  startAt: Date | null;
  endAt: Date | null;
  breakMinutes: number;
  type: string;
}): number {
  if (e.type !== "WORK" || !e.startAt || !e.endAt) return 0;
  const gross = e.endAt.getTime() - e.startAt.getTime();
  return Math.max(0, gross - e.breakMinutes * 60_000);
}

export async function computeDaysForRange(opts: {
  userId: string;
  from: Date;
  to: Date;
  timeZone: string;
  now?: Date;
}): Promise<DaySummaryWithMeta[]> {
  const now = opts.now ?? new Date();
  const todayCalendar = toCalendarDate(now, opts.timeZone).getTime();

  const [workEntries, absenceEntries, holidays, workingModels, user, halfDayRequests] =
    await Promise.all([
      db.timeEntry.findMany({
        where: {
          userId: opts.userId,
          date: { gte: opts.from, lt: opts.to },
          type: "WORK",
        },
        orderBy: { date: "asc" },
      }),
      db.timeEntry.findMany({
        where: {
          userId: opts.userId,
          date: { gte: opts.from, lt: opts.to },
          type: { in: ["VACATION", "SICK", "PUBLIC_HOLIDAY"] },
        },
        select: { date: true, type: true, note: true },
      }),
      db.publicHoliday.findMany({
        where: {
          date: { gte: opts.from, lt: opts.to },
        },
        select: { date: true, federalState: true },
      }),
      db.workingModel.findMany({
        where: {
          userId: opts.userId,
          validFrom: { lte: opts.to },
          OR: [{ validTo: null }, { validTo: { gte: opts.from } }],
        },
        orderBy: { validFrom: "desc" },
      }),
      db.user.findUnique({
        where: { id: opts.userId },
        select: { federalState: true },
      }),
      db.vacationRequest.findMany({
        where: { userId: opts.userId, halfDay: true, status: "APPROVED" },
        select: { from: true },
      }),
    ]);

  const byDay = new Map<number, { workedMs: number; breakMinutes: number; hasTimer: boolean }>();
  for (const e of workEntries) {
    const day = toCalendarDate(e.date, opts.timeZone).getTime();
    const existing = byDay.get(day) ?? { workedMs: 0, breakMinutes: 0, hasTimer: false };
    existing.workedMs += workedMsFromEntry(e);
    existing.breakMinutes += e.breakMinutes;
    if (e.source === "TIMER") existing.hasTimer = true;
    byDay.set(day, existing);
  }

  const absenceByDay = new Map<number, string[]>();
  const closureDays = new Set<number>();
  for (const e of absenceEntries) {
    const day = toCalendarDate(e.date, opts.timeZone).getTime();
    absenceByDay.set(day, [...(absenceByDay.get(day) ?? []), e.type]);
    if (e.type === "VACATION" && e.note?.startsWith(CLOSURE_NOTE_PREFIX)) closureDays.add(day);
  }

  const excusedDays = new Set<number>();
  for (const day of absenceByDay.keys()) {
    if (!byDay.has(day)) excusedDays.add(day);
  }
  if (user) {
    for (const h of holidays) {
      // Only holidays of the user's own federal state excuse a day.
      if (h.federalState !== user.federalState) continue;
      excusedDays.add(toCalendarDate(h.date, "UTC").getTime());
    }
  }

  // Genuine half days: approved halfDay requests (single day) plus the
  // configured 24.12/31.12 toggles. Everything else — e.g. a full-day
  // vacation with a stray WORK entry — keeps the full target.
  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const orgHalfDays = new Set<number>();
  for (const halfDayIso of halfDayDateSet(settings)) {
    const [m, d] = halfDayIso.split("-").map(Number);
    // Mark every occurrence of the MM-DD date within the range's years.
    const fromYear = toCalendarDate(opts.from, "UTC").getUTCFullYear();
    const toYear = toCalendarDate(opts.to, "UTC").getUTCFullYear();
    for (let y = fromYear; y <= toYear; y++) {
      orgHalfDays.add(toCalendarDate(new Date(Date.UTC(y, m - 1, d)), opts.timeZone).getTime());
    }
  }
  // A half-day request on a regular day covers only one half: the other half
  // is owed as work even though the day has a VACATION entry — unless a
  // business closure took the day over (request refunded, closure covers it).
  const requestHalfDays = new Set<number>();
  for (const r of halfDayRequests) {
    const day = toCalendarDate(r.from, opts.timeZone).getTime();
    if (!orgHalfDays.has(day) && !closureDays.has(day)) requestHalfDays.add(day);
  }

  function modelForDate(d: Date): WorkingModel | null {
    return (
      workingModels.find((m) => m.validFrom <= d && (m.validTo == null || m.validTo >= d)) ?? null
    );
  }

  const out: DaySummaryWithMeta[] = [];

  const startMs = toCalendarDate(opts.from, opts.timeZone).getTime();
  const endMs = toCalendarDate(opts.to, opts.timeZone).getTime();

  for (let dayMs = startMs; dayMs < endMs; dayMs += 86_400_000) {
    if (dayMs >= todayCalendar) break;

    const date = new Date(dayMs);
    const model = modelForDate(date);
    if (!model) continue;

    const targetMin = targetMinutesForDate(date, model);
    const agg = byDay.get(dayMs);
    if (targetMin === 0 && !agg) continue;

    // Genuine half dates — an approved halfDay request's day or the toggled
    // 24.12/31.12 (half working day for the org) — carry half the target,
    // whether worked or not. Everything else keeps the full target (e.g. a
    // full-day vacation with a stray work entry — legacy data must not inflate).
    const half = orgHalfDays.has(dayMs) || requestHalfDays.has(dayMs);
    const modelForSummary = half
      ? { ...model, [dayKeyForDate(date)]: halfDayMinutesFor(model, date) }
      : model;
    // Absences/holidays excuse an unworked day — except the owed half of a
    // half-day request. A booked 24.12/31.12 is fully covered (half free, half booked).
    if (!agg && excusedDays.has(dayMs) && !requestHalfDays.has(dayMs)) continue;
    const summary = summarizeDay({
      date,
      workedMs: agg?.workedMs ?? 0,
      breakMinutes: agg?.breakMinutes ?? 0,
      model: modelForSummary,
    });
    out.push({ ...summary, hasTimerEntry: agg?.hasTimer ?? false });
  }

  return out;
}

export async function computeYearOvertime(opts: {
  userId: string;
  year: number;
  timeZone: string;
}): Promise<{
  computation: OvertimeComputation;
  days: DaySummaryWithMeta[];
  carriedOverMinutes: number;
  consumedOvertimeMinutes: number;
}> {
  const yearStart = new Date(Date.UTC(opts.year, 0, 1));
  const yearEnd = new Date(Date.UTC(opts.year + 1, 0, 1));

  const user = await db.user.findUnique({
    where: { id: opts.userId },
    select: { hireDate: true },
  });

  const from = user?.hireDate && user.hireDate > yearStart ? user.hireDate : yearStart;

  const days = await computeDaysForRange({
    userId: opts.userId,
    from,
    to: yearEnd,
    timeZone: opts.timeZone,
  });

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const prevBalance = await db.overtimeBalance.findUnique({
    where: { userId_year: { userId: opts.userId, year: opts.year } },
  });
  const carriedOverMinutes = prevBalance?.carriedOverMinutes ?? 0;
  const consumedOvertimeMinutes = prevBalance?.consumedOvertimeMinutes ?? 0;

  const computation = computeOvertimeForYear({
    year: opts.year,
    days,
    carriedOverMinutes,
    consumedOvertimeMinutes,
  });
  return { computation, days, carriedOverMinutes, consumedOvertimeMinutes };
}

export async function upsertOvertimeBalance(opts: {
  userId: string;
  year: number;
  computation: OvertimeComputation;
}): Promise<void> {
  const computedMinutes = Math.round(opts.computation.totalDeltaMs / 60_000);
  await db.overtimeBalance.upsert({
    where: { userId_year: { userId: opts.userId, year: opts.year } },
    create: {
      userId: opts.userId,
      year: opts.year,
      carriedOverMinutes: opts.computation.carriedOverMinutes,
      computedMinutes,
    },
    update: {
      carriedOverMinutes: opts.computation.carriedOverMinutes,
      computedMinutes,
    },
  });
}

export async function getOvertimeView(opts: {
  actor: SessionUser;
  targetUserId?: string;
  year?: number;
}) {
  const userId = opts.targetUserId ?? opts.actor.id;
  if (userId !== opts.actor.id && opts.actor.role !== "ADMIN") {
    throw new Response("Forbidden", { status: 403 });
  }
  const ctx = await getUserContext(userId);
  const year = opts.year ?? new Date().getUTCFullYear();
  const { computation, days } = await computeYearOvertime({
    userId,
    year,
    timeZone: ctx.timeZone,
  });
  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const cutoff = settings.overtimeCarryoverCutoffEnabled
    ? carryoverCutoffDate(
        year,
        settings.overtimeCarryoverCutoffMonth,
        settings.overtimeCarryoverCutoffDay
      )
    : null;

  return {
    userId,
    year,
    timeZone: ctx.timeZone,
    computation,
    days,
    cutoff,
    settings,
    signedBalance: formatSignedDuration(computation.balanceMs),
    balanceHours: msToSignedHours(computation.balanceMs),
  };
}

export { formatSignedDuration, msToSignedHours };

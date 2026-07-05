import { db } from "@/lib/db";
import { getUserContext, type SessionUser } from "@/server/context";
import { getActiveWorkingModel } from "@/server/services/timer";
import {
  computeOvertimeForYear,
  summarizeDay,
  carryoverCutoffDate,
  formatSignedDuration,
  msToSignedHours,
  type OvertimeComputation,
  type DaySummary,
} from "@/lib/overtime/calculate";
import { toCalendarDate, addDaysUtc } from "@/lib/datetime";
import type { TimeEntry, WorkingModel } from "@prisma/client";

export type DaySummaryWithMeta = DaySummary & {
  hasTimerEntry: boolean;
};

export function workedMsFromEntry(e: { startAt: Date | null; endAt: Date | null; breakMinutes: number; type: string }): number {
  if (e.type !== "WORK" || !e.startAt || !e.endAt) return 0;
  const gross = e.endAt.getTime() - e.startAt.getTime();
  return Math.max(0, gross - e.breakMinutes * 60_000);
}

export async function computeDaysForRange(opts: {
  userId: string;
  from: Date;
  to: Date;
  timeZone: string;
}): Promise<DaySummaryWithMeta[]> {
  const entries = await db.timeEntry.findMany({
    where: {
      userId: opts.userId,
      date: { gte: opts.from, lt: opts.to },
      type: "WORK",
    },
    orderBy: { date: "asc" },
  });

  const byDay = new Map<number, { workedMs: number; breakMinutes: number; hasTimer: boolean }>();
  for (const e of entries) {
    const day = toCalendarDate(e.date, opts.timeZone).getTime();
    const existing = byDay.get(day) ?? { workedMs: 0, breakMinutes: 0, hasTimer: false };
    existing.workedMs += workedMsFromEntry(e);
    existing.breakMinutes += e.breakMinutes;
    if (e.source === "TIMER") existing.hasTimer = true;
    byDay.set(day, existing);
  }

  const out: DaySummaryWithMeta[] = [];
  const workingModels = await db.workingModel.findMany({
    where: {
      userId: opts.userId,
      validFrom: { lte: opts.to },
      OR: [{ validTo: null }, { validTo: { gte: opts.from } }],
    },
    orderBy: { validFrom: "desc" },
  });

  function modelForDate(d: Date): WorkingModel | null {
    return (
      workingModels.find(
        (m) => m.validFrom <= d && (m.validTo == null || m.validTo >= d)
      ) ?? null
    );
  }

  const dayKeys = Array.from(byDay.keys()).sort((a, b) => a - b);
  for (const dayMs of dayKeys) {
    const date = new Date(dayMs);
    const agg = byDay.get(dayMs)!;
    const model = modelForDate(date);
    if (!model) continue;
    const summary = summarizeDay({
      date,
      workedMs: agg.workedMs,
      breakMinutes: agg.breakMinutes,
      model,
    });
    out.push({ ...summary, hasTimerEntry: agg.hasTimer });
  }
  return out;
}

export async function computeYearOvertime(opts: {
  userId: string;
  year: number;
  timeZone: string;
}): Promise<{ computation: OvertimeComputation; days: DaySummaryWithMeta[]; carriedOverMinutes: number }> {
  const from = new Date(Date.UTC(opts.year, 0, 1));
  const to = new Date(Date.UTC(opts.year + 1, 0, 1));
  const days = await computeDaysForRange({
    userId: opts.userId,
    from,
    to,
    timeZone: opts.timeZone,
  });

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const prevBalance = await db.overtimeBalance.findUnique({
    where: { userId_year: { userId: opts.userId, year: opts.year } },
  });
  const carriedOverMinutes = prevBalance?.carriedOverMinutes ?? 0;

  const computation = computeOvertimeForYear({
    year: opts.year,
    days,
    carriedOverMinutes,
  });
  return { computation, days, carriedOverMinutes };
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
  const cutoff = carryoverCutoffDate(year, settings.overtimeCarryoverCutoffMonth, settings.overtimeCarryoverCutoffDay);

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

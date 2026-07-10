import { db } from "@/lib/db";
import { getUserContext } from "@/server/context";
import { toCalendarDate, addDaysUtc } from "@/lib/datetime";
import {
  toTimerState,
  computeElapsedMs,
  computeBreakMs,
  isOnBreak,
  msToMinutes,
  type TimerState,
} from "@/lib/timer-utils";
import { resolveBreakMinutes } from "@/lib/overtime/breaks";
import type { WorkingModel, TimerSession } from "@prisma/client";

export async function getActiveWorkingModel(
  userId: string,
  reference: Date
): Promise<WorkingModel | null> {
  const models = await db.workingModel.findMany({
    where: {
      userId,
      validFrom: { lte: reference },
      OR: [{ validTo: null }, { validTo: { gte: reference } }],
    },
    orderBy: { validFrom: "desc" },
    take: 1,
  });
  return models[0] ?? null;
}

export class TimerError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

export type TimerStatus = {
  active: boolean;
  onBreak: boolean;
  startedAt: string | null;
  breakStartedAt: string | null;
  elapsedMs: number;
  breakMs: number;
  state: TimerState | null;
  todayWorkedMs: number;
  lastWorkEndAt: string | null;
};

export async function getTimerStatus(userId: string, now: Date = new Date()): Promise<TimerStatus> {
  const ctx = await getUserContext(userId);
  const todayStart = toCalendarDate(now, ctx.timeZone);
  const todayEntries = await db.timeEntry.findMany({
    where: {
      userId,
      date: { gte: todayStart, lt: new Date(todayStart.getTime() + 86_400_000) },
    },
  });
  const todayWorkedMs = todayEntries.reduce((sum, e) => {
    if (e.type !== "WORK" || !e.startAt || !e.endAt) return sum;
    const gross = e.endAt.getTime() - e.startAt.getTime();
    return sum + Math.max(0, gross - e.breakMinutes * 60_000);
  }, 0);

  // Find the most recent WORK entry end time (today + yesterday) for rest period check
  const recentEntries = await db.timeEntry.findMany({
    where: {
      userId,
      type: "WORK",
      endAt: { not: null },
      date: { gte: addDaysUtc(todayStart, -1), lt: new Date(todayStart.getTime() + 86_400_000) },
    },
    orderBy: { endAt: "desc" },
    take: 1,
  });
  const lastWorkEndAt = recentEntries[0]?.endAt?.toISOString() ?? null;

  const session = await db.timerSession.findUnique({ where: { userId } });
  if (!session) {
    return {
      active: false,
      onBreak: false,
      startedAt: null,
      breakStartedAt: null,
      elapsedMs: 0,
      breakMs: 0,
      state: null,
      todayWorkedMs,
      lastWorkEndAt,
    };
  }
  const state = toTimerState(session);
  const nowMs = now.getTime();
  return {
    active: true,
    onBreak: isOnBreak(state),
    startedAt: session.startedAt.toISOString(),
    breakStartedAt: session.breakStartedAt ? session.breakStartedAt.toISOString() : null,
    elapsedMs: computeElapsedMs(state, nowMs),
    breakMs: computeBreakMs(state, nowMs),
    state,
    todayWorkedMs,
    lastWorkEndAt,
  };
}

export async function startTimer(userId: string, now: Date = new Date()): Promise<TimerSession> {
  const existing = await db.timerSession.findUnique({ where: { userId } });
  if (existing) {
    throw new TimerError("Timer already running", "ALREADY_RUNNING");
  }
  return db.timerSession.create({
    data: {
      userId,
      startedAt: now,
      lastTickAt: now,
      breakStartedAt: null,
      accumulatedBreakMs: 0,
    },
  });
}

export async function startBreak(userId: string, now: Date = new Date()): Promise<TimerSession> {
  const session = await db.timerSession.findUnique({ where: { userId } });
  if (!session) throw new TimerError("No active timer", "NO_TIMER");
  if (session.breakStartedAt) throw new TimerError("Already on break", "ALREADY_ON_BREAK");
  return db.timerSession.update({
    where: { userId },
    data: { breakStartedAt: now, lastTickAt: now },
  });
}

export async function endBreak(userId: string, now: Date = new Date()): Promise<TimerSession> {
  const session = await db.timerSession.findUnique({ where: { userId } });
  if (!session) throw new TimerError("No active timer", "NO_TIMER");
  if (!session.breakStartedAt) throw new TimerError("Not on break", "NOT_ON_BREAK");
  const added = now.getTime() - session.breakStartedAt.getTime();
  return db.timerSession.update({
    where: { userId },
    data: {
      breakStartedAt: null,
      accumulatedBreakMs: session.accumulatedBreakMs + Math.max(0, added),
      lastTickAt: now,
    },
  });
}

export async function stopTimer(userId: string, now: Date = new Date()) {
  const session = await db.timerSession.findUnique({ where: { userId } });
  if (!session) throw new TimerError("No active timer", "NO_TIMER");

  const ctx = await getUserContext(userId);
  const state = toTimerState(session);
  const nowMs = now.getTime();
  const workedMs = computeElapsedMs(state, nowMs);
  const manualBreakMs = computeBreakMs(state, nowMs);
  const manualBreakMinutes = msToMinutes(manualBreakMs);

  const finalStartedAt = session.startedAt;
  const endAt = now;

  const date = toCalendarDate(finalStartedAt, ctx.timeZone);

  // Resolve final break minutes per the user's break mode.
  const workingModel = await getActiveWorkingModel(userId, finalStartedAt);
  let breakMinutes = manualBreakMinutes;
  let autoApplied = false;
  if (workingModel) {
    const resolved = resolveBreakMinutes({
      breakMode: ctx.user.breakMode,
      workedMs,
      manualBreakMinutes,
      model: workingModel,
    });
    breakMinutes = resolved.minutes;
    autoApplied = resolved.source === "auto";
  }

  const timeEntry = await db.timeEntry.create({
    data: {
      userId,
      date,
      startAt: finalStartedAt,
      endAt: endAt,
      breakMinutes,
      type: "WORK",
      source: "TIMER",
    },
  });

  await db.timerSession.delete({ where: { userId } });

  return { timeEntry, breakMinutes, autoApplied, workedMinutes: msToMinutes(workedMs) };
}

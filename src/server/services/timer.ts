import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";
import { toCalendarDate, addDaysUtc } from "@/lib/datetime";
import { assertNoOverlap, TimeEntryError } from "@/server/services/time-entry";
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

/** Max age of a backdated (remote) start; anything older needs manual entries. */
const REMOTE_START_MAX_AGE_MS = 48 * 3_600_000;

/**
 * Admin remote control: start (or stop) another user's timer.
 * Backdating is limited to the last 48h and must not overlap completed
 * WORK entries — otherwise stopTimer would produce duplicates.
 */
export async function remoteStartTimer(opts: {
  actor: SessionUser;
  userId: string;
  startAt?: Date;
  now?: Date;
}): Promise<TimerSession> {
  if (opts.actor.role !== "ADMIN") {
    throw new TimerError("Forbidden", "FORBIDDEN");
  }
  const now = opts.now ?? new Date();
  const startAt = opts.startAt ?? now;

  if (startAt.getTime() > now.getTime()) {
    throw new TimerError("Start time is in the future", "INVALID_START");
  }
  if (now.getTime() - startAt.getTime() > REMOTE_START_MAX_AGE_MS) {
    throw new TimerError("Start time is too far in the past", "INVALID_START");
  }

  const targetUser = await db.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, active: true },
  });
  if (!targetUser || !targetUser.active) {
    throw new TimerError("User not found", "NOT_FOUND");
  }

  try {
    const ctx = await getUserContext(opts.userId);
    if (startAt.getTime() < now.getTime()) {
      await assertNoOverlap(opts.userId, startAt, now, ctx.timeZone);
    }
    await startTimer(opts.userId, startAt);
  } catch (e) {
    if (e instanceof TimeEntryError) {
      throw new TimerError(e.message, e.code);
    }
    if (e instanceof TimerError && e.code === "ALREADY_RUNNING") throw e;
    throw e;
  }

  await audit({
    actorId: opts.actor.id,
    targetId: opts.userId,
    action: "timer.remoteStart",
    entity: "TimerSession",
    entityId: opts.userId,
    payload: { startAt: startAt.toISOString(), backdated: startAt.getTime() < now.getTime() },
  });

  const session = await db.timerSession.findUniqueOrThrow({ where: { userId: opts.userId } });
  return session;
}

export async function remoteStopTimer(opts: { actor: SessionUser; userId: string; now?: Date }) {
  if (opts.actor.role !== "ADMIN") {
    throw new TimerError("Forbidden", "FORBIDDEN");
  }
  const existing = await db.timerSession.findUnique({ where: { userId: opts.userId } });
  if (!existing) {
    throw new TimerError("No active timer", "NO_TIMER");
  }
  const result = await stopTimer(opts.userId, opts.now ?? new Date());
  await audit({
    actorId: opts.actor.id,
    targetId: opts.userId,
    action: "timer.remoteStop",
    entity: "TimeEntry",
    entityId: result.timeEntry.id,
    payload: { workedMinutes: result.workedMinutes },
  });
  return result;
}

import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";
import { toCalendarDate, addDaysUtc } from "@/lib/datetime";
import { isEntryLocked } from "@/lib/timer-utils";
import { applyBreakPolicyToEntry } from "@/lib/overtime/breaks";
import { getActiveWorkingModel } from "@/server/services/timer";
import {
  createTimeEntrySchema,
  updateTimeEntrySchema,
  type CreateTimeEntryInput,
  type UpdateTimeEntryInput,
} from "@/lib/validations/time-entry";
import type { TimeEntry } from "@prisma/client";

export class TimeEntryError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
  }
}

export type ListFilter = {
  from?: Date;
  to?: Date;
  type?: TimeEntry["type"];
};

export async function listTimeEntries(opts: {
  actor: SessionUser;
  targetUserId?: string;
  filter?: ListFilter;
}): Promise<TimeEntry[]> {
  const userId = resolveTargetUserId(opts.actor, opts.targetUserId);
  assertCanRead(opts.actor, userId);
  const where: Record<string, unknown> = { userId };
  if (opts.filter?.from || opts.filter?.to) {
    where.date = {};
    if (opts.filter?.from) (where.date as { gte: Date }).gte = opts.filter.from;
    if (opts.filter?.to) (where.date as { lte: Date }).lte = opts.filter.to;
  }
  if (opts.filter?.type) where.type = opts.filter.type;
  return db.timeEntry.findMany({
    where: where as never,
    orderBy: { date: "asc" },
  });
}

export async function createTimeEntry(opts: {
  actor: SessionUser;
  targetUserId?: string;
  input: CreateTimeEntryInput;
}): Promise<TimeEntry> {
  const userId = resolveTargetUserId(opts.actor, opts.targetUserId);
  assertCanWrite(opts.actor, userId);
  const ctx = await getUserContext(userId);

  // Normalize the date to the calendar date in the target user's tz.
  const date = toCalendarDate(opts.input.date, ctx.timeZone);

  // Lock-window: employees cannot create entries older than the window.
  if (opts.actor.role !== "ADMIN" && isEntryLocked(date, ctx.lockWindowDays)) {
    throw new TimeEntryError("Entry is outside the editable window", "LOCKED", 403);
  }

  const isAdminForOther = opts.actor.role === "ADMIN" && userId !== opts.actor.id;

  if (opts.input.type === "WORK" && opts.input.startAt && opts.input.endAt) {
    await assertNoOverlap(userId, opts.input.startAt, opts.input.endAt, ctx.timeZone);
  }

  // Apply the org's break mode: in AUTO the user's break input is forced to
  // the statutory break computed from the worked duration (ArbZG §4), same as
  // a timer stop. MANUAL mode keeps the user's value.
  let breakMinutes = opts.input.breakMinutes;
  const model = await getActiveWorkingModel(userId, date);
  if (model) {
    const applied = applyBreakPolicyToEntry({
      type: opts.input.type,
      breakMode: ctx.user.breakMode,
      startAt: opts.input.startAt,
      endAt: opts.input.endAt,
      manualBreakMinutes: opts.input.breakMinutes,
      model,
    });
    if (applied !== null) breakMinutes = applied;
  }

  const entry = await db.timeEntry.create({
    data: {
      userId,
      date,
      startAt: opts.input.startAt,
      endAt: opts.input.endAt,
      breakMinutes,
      type: opts.input.type,
      source: isAdminForOther ? "ADMIN" : "MANUAL",
      note: opts.input.note ?? null,
    },
  });

  await audit({
    actorId: opts.actor.id,
    targetId: userId,
    action: "time_entry.create",
    entity: "TimeEntry",
    entityId: entry.id,
    payload: { date: date.toISOString(), type: entry.type },
  });

  return entry;
}

export async function updateTimeEntry(opts: {
  actor: SessionUser;
  entryId: string;
  input: UpdateTimeEntryInput;
}): Promise<TimeEntry> {
  const existing = await db.timeEntry.findUnique({ where: { id: opts.entryId } });
  if (!existing) throw new TimeEntryError("Not found", "NOT_FOUND", 404);

  assertCanWrite(opts.actor, existing.userId);

  const ctx = await getUserContext(existing.userId);

  // Use the (possibly updated) date for lock check; fall back to existing.
  const checkDate = opts.input.date ? toCalendarDate(opts.input.date, ctx.timeZone) : existing.date;
  if (opts.actor.role !== "ADMIN" && isEntryLocked(checkDate, ctx.lockWindowDays)) {
    throw new TimeEntryError("Entry is locked", "LOCKED", 403);
  }

  const data: Record<string, unknown> = {};
  if (opts.input.date !== undefined) data.date = toCalendarDate(opts.input.date, ctx.timeZone);
  if (opts.input.startAt !== undefined) data.startAt = opts.input.startAt;
  if (opts.input.endAt !== undefined) data.endAt = opts.input.endAt;
  if (opts.input.breakMinutes !== undefined) data.breakMinutes = opts.input.breakMinutes;
  if (opts.input.type !== undefined) data.type = opts.input.type;
  if (opts.input.note !== undefined) data.note = opts.input.note ?? null;

  const finalType = (data.type as string | undefined) ?? existing.type;
  const finalStart = (data.startAt as Date | undefined) ?? existing.startAt;
  const finalEnd = (data.endAt as Date | undefined) ?? existing.endAt;
  const finalBreak = (data.breakMinutes as number | undefined) ?? existing.breakMinutes;

  if (finalType === "WORK" && finalStart && finalEnd) {
    await assertNoOverlap(existing.userId, finalStart, finalEnd, ctx.timeZone, existing.id);

    // Enforce the break-mode policy on updates as well: AUTO recalculates
    // from the final worked duration (also when the duration was changed),
    // MANUAL keeps the submitted value. Reuses the outer checkDate.
    const model = await getActiveWorkingModel(existing.userId, checkDate);
    if (model) {
      const applied = applyBreakPolicyToEntry({
        type: finalType,
        breakMode: ctx.user.breakMode,
        startAt: finalStart,
        endAt: finalEnd,
        manualBreakMinutes: finalBreak,
        model,
      });
      if (applied !== null) data.breakMinutes = applied;
    }
  }

  const updated = await db.timeEntry.update({
    where: { id: opts.entryId },
    data: data as never,
  });

  await audit({
    actorId: opts.actor.id,
    targetId: existing.userId,
    action: "time_entry.update",
    entity: "TimeEntry",
    entityId: existing.id,
    payload: { changes: Object.keys(data) },
  });

  return updated;
}

export async function deleteTimeEntry(opts: {
  actor: SessionUser;
  entryId: string;
}): Promise<{ id: string }> {
  const existing = await db.timeEntry.findUnique({ where: { id: opts.entryId } });
  if (!existing) throw new TimeEntryError("Not found", "NOT_FOUND", 404);

  assertCanWrite(opts.actor, existing.userId);

  const ctx = await getUserContext(existing.userId);
  if (opts.actor.role !== "ADMIN" && isEntryLocked(existing.date, ctx.lockWindowDays)) {
    throw new TimeEntryError("Entry is locked", "LOCKED", 403);
  }

  await db.timeEntry.delete({ where: { id: opts.entryId } });

  await audit({
    actorId: opts.actor.id,
    targetId: existing.userId,
    action: "time_entry.delete",
    entity: "TimeEntry",
    entityId: existing.id,
    payload: {
      date: existing.date.toISOString(),
      type: existing.type,
      breakMinutes: existing.breakMinutes,
    },
  });

  return { id: existing.id };
}

function resolveTargetUserId(actor: SessionUser, targetUserId?: string): string {
  if (targetUserId && targetUserId !== actor.id && actor.role !== "ADMIN") {
    throw new TimeEntryError("Forbidden", "FORBIDDEN", 403);
  }
  return targetUserId ?? actor.id;
}

function assertCanRead(actor: SessionUser, userId: string) {
  if (userId !== actor.id && actor.role !== "ADMIN") {
    throw new TimeEntryError("Forbidden", "FORBIDDEN", 403);
  }
}

function assertCanWrite(actor: SessionUser, userId: string) {
  if (userId !== actor.id && actor.role !== "ADMIN") {
    throw new TimeEntryError("Forbidden", "FORBIDDEN", 403);
  }
}

async function assertNoOverlap(
  userId: string,
  startAt: Date,
  endAt: Date,
  timeZone: string,
  excludeEntryId?: string
): Promise<void> {
  const dayStart = toCalendarDate(startAt, timeZone);
  const dayEnd = addDaysUtc(dayStart, 1);

  const where: Record<string, unknown> = {
    userId,
    type: "WORK",
    startAt: { not: null },
    endAt: { not: null },
    date: { gte: dayStart, lt: dayEnd },
    AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
  };
  if (excludeEntryId) {
    where.id = { not: excludeEntryId };
  }

  const overlapping = await db.timeEntry.findFirst({ where: where as never });
  if (overlapping) {
    throw new TimeEntryError("Time entry overlaps with an existing entry", "OVERLAP", 409);
  }
}

export { createTimeEntrySchema, updateTimeEntrySchema };
export function weekRangeUtc(reference: Date, timeZone: string) {
  const start = weekStartUtc(reference, timeZone);
  return { start, end: addDaysUtc(start, 7) };
}

function weekStartUtc(reference: Date, timeZone: string): Date {
  const day = toCalendarDate(reference, timeZone);
  const weekday = day.getUTCDay();
  const diff = (weekday + 6) % 7;
  const monday = new Date(day);
  monday.setUTCDate(day.getUTCDate() - diff);
  return monday;
}

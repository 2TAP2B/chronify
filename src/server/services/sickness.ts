import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";
import { sendMail } from "@/server/services/mail";
import { sickNoteReminderEmail } from "@/lib/email-templates";
import { businessDaysInRange, makeHolidayResolver } from "@/lib/vacation/business-days";
import { toCalendarDate } from "@/lib/datetime";
import type { SickNote } from "@prisma/client";

export class SicknessError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
  }
}

export type SickNoteCreateInput = {
  from: Date;
  to: Date;
  aubUntil?: Date | null;
  note?: string | null;
};

export type SickNoteUpdateInput = Partial<SickNoteCreateInput>;

export async function listSickNotes(opts: {
  actor: SessionUser;
  targetUserId?: string;
  year?: number;
}): Promise<{ notes: SickNote[]; targetUserId: string }> {
  const userId = resolveTarget(opts.actor, opts.targetUserId);
  const where: Record<string, unknown> = {};
  if (opts.actor.role !== "ADMIN" || opts.targetUserId) where.userId = userId;
  if (opts.year) {
    const start = new Date(Date.UTC(opts.year, 0, 1));
    const end = new Date(Date.UTC(opts.year + 1, 0, 1));
    where.from = { gte: start, lt: end };
  }
  const notes = await db.sickNote.findMany({
    where: where as never,
    orderBy: { from: "desc" },
  });
  return { notes, targetUserId: userId };
}

export async function listAllSickNotes(
  actor: SessionUser
): Promise<Array<SickNote & { userName: string; userEmail: string }>> {
  if (actor.role !== "ADMIN") {
    throw new SicknessError("Forbidden", "FORBIDDEN", 403);
  }
  const notes = await db.sickNote.findMany({
    orderBy: { from: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return notes.map((n) => ({ ...n, userName: n.user.name, userEmail: n.user.email }));
}

export async function createSickNote(opts: {
  actor: SessionUser;
  targetUserId?: string;
  input: SickNoteCreateInput;
}): Promise<SickNote> {
  const userId = resolveTarget(opts.actor, opts.targetUserId);
  const { from, to } = opts.input;
  if (from.getTime() > to.getTime()) {
    throw new SicknessError("from > to", "INVALID_RANGE");
  }

  const ctx = await getUserContext(userId);
  const state = ctx.user.federalState;
  const holidays = await db.publicHoliday.findMany({
    where: { federalState: state, date: { gte: from, lte: to } },
  });
  const resolver = makeHolidayResolver(holidays);
  const { businessDays } = businessDaysInRange(from, to, state, resolver);

  const note = await db.sickNote.create({
    data: {
      userId,
      from,
      to,
      days: businessDays.length,
      aubUntil: opts.input.aubUntil ?? null,
      note: opts.input.note ?? null,
    },
  });

  // Create TimeEntry{type:SICK} per business day
  await db.timeEntry.createMany({
    data: businessDays.map((d) => ({
      userId,
      date: toCalendarDate(d, ctx.timeZone),
      startAt: null,
      endAt: null,
      breakMinutes: 0,
      type: "SICK",
      source: opts.actor.role === "ADMIN" && userId !== opts.actor.id ? "ADMIN" : "MANUAL",
      note: `Krankheit ${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)}`,
    })),
  });

  await audit({
    actorId: opts.actor.id,
    targetId: userId,
    action: "sick_note.create",
    entity: "SickNote",
    entityId: note.id,
    payload: { from: from.toISOString(), to: to.toISOString(), days: businessDays.length },
  });

  if (!opts.input.aubUntil && ctx.user.sickMailEnabled) {
    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const appName = process.env.APP_NAME ?? "Chronify";
    const sicknessUrl = `${appUrl}/${ctx.user.locale ?? "de"}/sickness`;
    const mailContent = sickNoteReminderEmail({
      locale: (ctx.user.locale ?? "de") as "de" | "en",
      appName,
      recipientName: ctx.user.name,
      sickFrom: from.toISOString().slice(0, 10),
      sicknessUrl,
    });
    await sendMail({
      to: ctx.user.email,
      subject: mailContent.subject,
      html: mailContent.html,
      text: mailContent.text,
    }).catch(() => {});
  }

  return note;
}

export async function updateSickNote(opts: {
  actor: SessionUser;
  noteId: string;
  input: SickNoteUpdateInput;
}): Promise<SickNote> {
  const existing = await db.sickNote.findUnique({ where: { id: opts.noteId } });
  if (!existing) throw new SicknessError("Not found", "NOT_FOUND", 404);
  assertCanWrite(opts.actor, existing.userId);

  const data: Record<string, unknown> = {};
  if (opts.input.from !== undefined) data.from = opts.input.from;
  if (opts.input.to !== undefined) data.to = opts.input.to;
  if (opts.input.aubUntil !== undefined) data.aubUntil = opts.input.aubUntil ?? null;
  if (opts.input.note !== undefined) data.note = opts.input.note ?? null;

  // Recompute days if from/to changed
  if (opts.input.from !== undefined || opts.input.to !== undefined) {
    const from = opts.input.from ?? existing.from;
    const to = opts.input.to ?? existing.to;
    const ctx = await getUserContext(existing.userId);
    const holidays = await db.publicHoliday.findMany({
      where: { federalState: ctx.user.federalState, date: { gte: from, lte: to } },
    });
    const resolver = makeHolidayResolver(holidays);
    const { businessDays } = businessDaysInRange(from, to, ctx.user.federalState, resolver);
    data.days = businessDays.length;

    // Delete old TimeEntries and recreate
    await db.timeEntry.deleteMany({
      where: {
        userId: existing.userId,
        type: "SICK",
        date: { gte: existing.from, lte: existing.to },
      },
    });
    await db.timeEntry.createMany({
      data: businessDays.map((d) => ({
        userId: existing.userId,
        date: toCalendarDate(d, ctx.timeZone),
        startAt: null,
        endAt: null,
        breakMinutes: 0,
        type: "SICK",
        source: "ADMIN",
        note: `Krankheit ${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)}`,
      })),
    });
  }

  const updated = await db.sickNote.update({
    where: { id: opts.noteId },
    data: data as never,
  });

  await audit({
    actorId: opts.actor.id,
    targetId: existing.userId,
    action: "sick_note.update",
    entity: "SickNote",
    entityId: existing.id,
    payload: { changes: Object.keys(data) },
  });

  return updated;
}

export async function deleteSickNote(opts: {
  actor: SessionUser;
  noteId: string;
}): Promise<{ id: string }> {
  const existing = await db.sickNote.findUnique({ where: { id: opts.noteId } });
  if (!existing) throw new SicknessError("Not found", "NOT_FOUND", 404);
  assertCanWrite(opts.actor, existing.userId);

  // Delete associated TimeEntries
  await db.timeEntry.deleteMany({
    where: {
      userId: existing.userId,
      type: "SICK",
      date: { gte: existing.from, lte: existing.to },
    },
  });

  await db.sickNote.delete({ where: { id: opts.noteId } });

  await audit({
    actorId: opts.actor.id,
    targetId: existing.userId,
    action: "sick_note.delete",
    entity: "SickNote",
    entityId: existing.id,
  });

  return { id: existing.id };
}

function resolveTarget(actor: SessionUser, targetUserId?: string): string {
  if (targetUserId && targetUserId !== actor.id && actor.role !== "ADMIN") {
    throw new SicknessError("Forbidden", "FORBIDDEN", 403);
  }
  return targetUserId ?? actor.id;
}

function assertCanWrite(actor: SessionUser, userId: string) {
  if (userId !== actor.id && actor.role !== "ADMIN") {
    throw new SicknessError("Forbidden", "FORBIDDEN", 403);
  }
}

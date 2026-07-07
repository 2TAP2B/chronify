import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";
import { toCalendarDate } from "@/lib/datetime";
import { z } from "zod";

export class ImportError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
  }
}

export const importRowSchema = z.object({
  date: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export type ImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; error: string }[];
};

function parseDate(val: string): Date | null {
  const s = val.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (de) return new Date(Date.UTC(+de[3], +de[2] - 1, +de[1]));
  return null;
}

function parseTime(val: string): { h: number; m: number } | null {
  const s = val.trim();
  const m1 = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m1) return { h: +m1[1], m: +m1[2] };
  const m2 = /^(\d{1,2})\.(\d{2})$/.exec(s);
  if (m2) return { h: +m2[1], m: +m2[2] };
  return null;
}

function combineDateTime(date: Date, time: { h: number; m: number }, timeZone: string): Date {
  const [y, mo, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  const asZone = new Date(y, mo - 1, d, time.h, time.m, 0);
  const asUtc = Date.UTC(y, mo - 1, d, time.h, time.m, 0);
  const offset = asZone.getTime() - asUtc;
  return new Date(asUtc - offset);
}

export async function importTimeEntries(opts: {
  actor: SessionUser;
  targetUserId: string;
  rows: ImportRow[];
}): Promise<ImportResult> {
  if (opts.actor.role !== "ADMIN") {
    throw new ImportError("Forbidden", "FORBIDDEN", 403);
  }

  const ctx = await getUserContext(opts.targetUserId);
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  if (opts.rows.length === 0) return result;

  const existingEntries = await db.timeEntry.findMany({
    where: {
      userId: opts.targetUserId,
      type: "WORK",
      startAt: { not: null },
      endAt: { not: null },
    },
    select: { date: true, startAt: true, endAt: true },
  });

  const existingKeys = new Set(
    existingEntries.map((e) =>
      `${e.date.getTime()}|${e.startAt!.getTime()}|${e.endAt!.getTime()}`
    )
  );

  const toCreate: {
    userId: string;
    date: Date;
    startAt: Date;
    endAt: Date;
    breakMinutes: number;
    type: "WORK";
    source: "MANUAL";
    note: string | null;
  }[] = [];

  for (let i = 0; i < opts.rows.length; i++) {
    const row = opts.rows[i];
    const rowNum = i + 2;

    const parsed = importRowSchema.safeParse(row);
    if (!parsed.success) {
      result.errors.push({ row: rowNum, error: "Invalid row data" });
      continue;
    }

    const date = parseDate(parsed.data.date);
    if (!date) {
      result.errors.push({ row: rowNum, error: `Invalid date: ${parsed.data.date}` });
      continue;
    }

    const startTime = parseTime(parsed.data.startAt);
    const endTime = parseTime(parsed.data.endAt);
    if (!startTime) {
      result.errors.push({ row: rowNum, error: `Invalid start time: ${parsed.data.startAt}` });
      continue;
    }
    if (!endTime) {
      result.errors.push({ row: rowNum, error: `Invalid end time: ${parsed.data.endAt}` });
      continue;
    }

    const calendarDate = toCalendarDate(date, ctx.timeZone);
    const startAt = combineDateTime(date, startTime, ctx.timeZone);
    const endAt = combineDateTime(date, endTime, ctx.timeZone);

    if (endAt <= startAt) {
      result.errors.push({ row: rowNum, error: "End time must be after start time" });
      continue;
    }

    const key = `${calendarDate.getTime()}|${startAt.getTime()}|${endAt.getTime()}`;
    if (existingKeys.has(key)) {
      result.skipped++;
      continue;
    }

    existingKeys.add(key);
    toCreate.push({
      userId: opts.targetUserId,
      date: calendarDate,
      startAt,
      endAt,
      breakMinutes: 0,
      type: "WORK",
      source: "MANUAL",
      note: null,
    });
  }

  if (toCreate.length > 0) {
    await db.timeEntry.createMany({
      data: toCreate as never,
    });
  }

  result.created = toCreate.length;

  await audit({
    actorId: opts.actor.id,
    targetId: opts.targetUserId,
    action: "time_entry.import",
    entity: "TimeEntry",
    entityId: "bulk",
    payload: { created: result.created, skipped: result.skipped, errors: result.errors.length },
  });

  return result;
}
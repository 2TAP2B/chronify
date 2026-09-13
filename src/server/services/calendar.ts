import { db } from "@/lib/db";
import { type SessionUser, getUserContext } from "@/server/context";
import { toCalendarDate, formatInZone } from "@/lib/datetime";

export type CalendarEventType =
  "WORK" | "VACATION" | "VACATION_PENDING" | "SICK" | "PUBLIC_HOLIDAY" | "CLOSURE";

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  note?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  breakMinutes?: number;
  vacationStatus?: string;
};

export async function getUserCalendar(opts: {
  actor: SessionUser;
  year: number;
  month: number;
}): Promise<CalendarEvent[]> {
  const ctx = await getUserContext(opts.actor.id);
  const timeZone = ctx.timeZone;
  const federalState = ctx.user.federalState;

  const from = new Date(Date.UTC(opts.year, opts.month - 1, 1));
  const to = new Date(Date.UTC(opts.year, opts.month, 1));

  const [timeEntries, vacations, sickNotes, holidays, closures] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        userId: opts.actor.id,
        date: { gte: from, lt: to },
      },
      orderBy: { date: "asc" },
    }),
    db.vacationRequest.findMany({
      where: {
        userId: opts.actor.id,
        from: { lt: to },
        to: { gte: from },
      },
      orderBy: { from: "asc" },
    }),
    db.sickNote.findMany({
      where: {
        userId: opts.actor.id,
        from: { lt: to },
        to: { gte: from },
      },
      orderBy: { from: "asc" },
    }),
    db.publicHoliday.findMany({
      where: {
        federalState,
        date: { gte: from, lt: to },
      },
    }),
    db.businessClosure.findMany({
      where: {
        from: { lt: to },
        to: { gte: from },
      },
    }),
  ]);

  const events: CalendarEvent[] = [];

  for (const te of timeEntries) {
    if (te.type === "WORK" && te.startAt && te.endAt) {
      const startStr = formatInZone(te.startAt, timeZone, "HH:mm");
      const endStr = formatInZone(te.endAt, timeZone, "HH:mm");
      const breakStr = te.breakMinutes > 0 ? ` -${te.breakMinutes}min` : "";
      events.push({
        id: `te-${te.id}`,
        type: "WORK",
        title: `${startStr}–${endStr}${breakStr}`,
        start: toCalendarDate(te.date, timeZone),
        end: toCalendarDate(te.date, timeZone),
        allDay: false,
        note: te.note,
        startAt: te.startAt.toISOString(),
        endAt: te.endAt.toISOString(),
        breakMinutes: te.breakMinutes,
      });
    } else if (te.type === "PERSONAL") {
      events.push({
        id: `te-${te.id}`,
        type: "WORK",
        title: te.note || "Personal",
        start: toCalendarDate(te.date, timeZone),
        end: toCalendarDate(te.date, timeZone),
        allDay: true,
        note: te.note,
      });
    }
  }

  for (const v of vacations) {
    const dayStart = toCalendarDate(v.from, timeZone);
    const dayEnd = toCalendarDate(v.to, timeZone);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const isPending = v.status === "PENDING";
    events.push({
      id: `vac-${v.id}`,
      type: isPending ? "VACATION_PENDING" : "VACATION",
      title: isPending ? "Urlaub (offen)" : "Urlaub",
      start: dayStart,
      end: dayEnd,
      allDay: true,
      note: v.note,
      vacationStatus: v.status,
    });
  }

  for (const s of sickNotes) {
    const dayStart = toCalendarDate(s.from, timeZone);
    const dayEnd = toCalendarDate(s.to, timeZone);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    events.push({
      id: `sick-${s.id}`,
      type: "SICK",
      title: "Krank",
      start: dayStart,
      end: dayEnd,
      allDay: true,
      note: s.note,
    });
  }

  for (const h of holidays) {
    const day = toCalendarDate(h.date, timeZone);
    events.push({
      id: `hol-${h.id}`,
      type: "PUBLIC_HOLIDAY",
      title: h.name,
      start: day,
      end: day,
      allDay: true,
    });
  }

  for (const c of closures) {
    const dayStart = toCalendarDate(c.from, timeZone);
    const dayEnd = toCalendarDate(c.to, timeZone);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    events.push({
      id: `cls-${c.id}`,
      type: "CLOSURE",
      title: c.name,
      start: dayStart,
      end: dayEnd,
      allDay: true,
    });
  }

  return events;
}

import { db } from "@/lib/db";
import { type SessionUser } from "@/server/context";
import { toCalendarDate, addDaysUtc } from "@/lib/datetime";
import type { FederalState } from "@prisma/client";

export type TeamDayEntry = {
  userId: string;
  userName: string;
  type: "VACATION" | "SICK" | "PUBLIC_HOLIDAY" | "CLOSURE";
  date: string;
  note?: string | null;
};

export type TeamCalendarDay = {
  date: string;
  weekday: number;
  isWeekend: boolean;
  isHoliday: boolean;
  isClosure: boolean;
  holidayName?: string;
  closureName?: string;
  entries: TeamDayEntry[];
};

export async function getTeamCalendar(opts: {
  actor: SessionUser;
  year: number;
  month: number;
  federalState?: FederalState;
}): Promise<{ days: TeamCalendarDay[]; users: { id: string; name: string }[] }> {
  const from = new Date(Date.UTC(opts.year, opts.month - 1, 1));
  const to = new Date(Date.UTC(opts.year, opts.month, 1));

  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, federalState: true },
  });

  // Gather all distinct federal states to query holidays
  const states = [...new Set(users.map((u) => u.federalState))];
  const holidays = await db.publicHoliday.findMany({
    where: {
      federalState: { in: states },
      date: { gte: from, lt: to },
    },
  });

  // Vacation requests (approved) and sick notes in range
  const [vacations, sickNotes] = await Promise.all([
    db.vacationRequest.findMany({
      where: {
        status: "APPROVED",
        from: { lt: to },
        to: { gte: from },
      },
      include: { user: { select: { name: true } } },
    }),
    db.sickNote.findMany({
      where: {
        from: { lt: to },
        to: { gte: from },
      },
      include: { user: { select: { name: true } } },
    }),
  ]);

  // Time entries (VACATION/SICK/PUBLIC_HOLIDAY) in range
  const [timeEntries, closures] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        date: { gte: from, lt: to },
        type: { in: ["VACATION", "SICK", "PUBLIC_HOLIDAY"] },
      },
      include: { user: { select: { name: true } } },
    }),
    db.businessClosure.findMany({
      where: {
        from: { lt: to },
        to: { gte: from },
      },
    }),
  ]);

  // Build day map
  const daysInMonth = new Date(Date.UTC(opts.year, opts.month, 0)).getUTCDate();
  const days: TeamCalendarDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(opts.year, opts.month - 1, d));
    const dateStr = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;

    // Per-user holiday lookup (each user has own federalState)
    const entries: TeamDayEntry[] = [];

    for (const u of users) {
      // Holiday for this user's state
      const holiday = holidays.find(
        (h) => h.federalState === u.federalState && toCalendarDate(h.date, "UTC").getTime() === date.getTime()
      );
      if (holiday) {
        entries.push({
          userId: u.id,
          userName: u.name,
          type: "PUBLIC_HOLIDAY",
          date: dateStr,
          note: holiday.name,
        });
        continue;
      }
      if (isWeekend) continue;

      // Business closure (applies to all users)
      const closure = closures.find(
        (c) => date.getTime() >= c.from.getTime() && date.getTime() <= c.to.getTime()
      );
      if (closure) {
        entries.push({
          userId: u.id,
          userName: u.name,
          type: "CLOSURE",
          date: dateStr,
          note: closure.name,
        });
        continue;
      }

      // Vacation
      const vac = vacations.find(
        (v) => v.userId === u.id && date.getTime() >= v.from.getTime() && date.getTime() <= v.to.getTime()
      );
      if (vac) {
        entries.push({
          userId: u.id,
          userName: u.name,
          type: "VACATION",
          date: dateStr,
          note: vac.note,
        });
        continue;
      }

      // Sick
      const sick = sickNotes.find(
        (s) => s.userId === u.id && date.getTime() >= s.from.getTime() && date.getTime() <= s.to.getTime()
      );
      if (sick) {
        entries.push({
          userId: u.id,
          userName: u.name,
          type: "SICK",
          date: dateStr,
          note: sick.note,
        });
        continue;
      }
    }

    // Determine if any holiday or closure applies (for the day header)
    const dayHoliday = holidays.find(
      (h) => toCalendarDate(h.date, "UTC").getTime() === date.getTime()
    );
    const dayClosure = closures.find(
      (c) => date.getTime() >= c.from.getTime() && date.getTime() <= c.to.getTime()
    );

    days.push({
      date: dateStr,
      weekday,
      isWeekend,
      isHoliday: !!dayHoliday,
      isClosure: !!dayClosure,
      holidayName: dayHoliday?.name,
      closureName: dayClosure?.name,
      entries,
    });
  }

  return {
    days,
    users: users.map((u) => ({ id: u.id, name: u.name })),
  };
}

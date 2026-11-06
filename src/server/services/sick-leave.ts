import { db } from "@/lib/db";
import {
  CLOSURE_NOTE_PREFIX,
  halfDayDateSet,
  halfDayMinutesFor,
  modelForDate,
  requestEntryNote,
  vacationWeight,
} from "@/lib/vacation/business-days";
import { targetMinutesForDate } from "@/lib/overtime/calculate";
import {
  computeLeaveCharge,
  ensureEntitlement,
  workingModelsInRange,
} from "@/server/services/leave-balance";
import type { FederalState } from "@prisma/client";

/**
 * Sickness during vacation (BUrlG §9): vacation days covered by a sick note
 * are not consumed. Their VACATION entries are removed and the charge is
 * refunded — vacation days to the entitlement, overtime minutes to the
 * overtime balance, for request vacation and closure vacation alike. When a
 * sick note is shortened or deleted, the vacation is booked again on the freed
 * days. Callers hold the user's leave lock.
 */

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function refundVacationOnSickDays(userId: string, days: Date[]): Promise<void> {
  if (days.length === 0) return;
  const keys = new Set(days.map(dayKey));
  const sorted = [...days].sort((a, b) => a.getTime() - b.getTime());
  const from = sorted[0];
  const to = sorted[sorted.length - 1];

  const [entries, settings, models, requests] = await Promise.all([
    db.timeEntry.findMany({
      where: { userId, type: "VACATION", date: { gte: from, lte: to } },
      select: { id: true, date: true, note: true },
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    workingModelsInRange(userId, from, to),
    db.vacationRequest.findMany({
      where: { userId, status: "APPROVED", from: { lte: to }, to: { gte: from } },
    }),
  ]);
  const halfDays = halfDayDateSet(settings);
  const sickEntries = entries.filter((e) => keys.has(dayKey(e.date)));

  for (const req of requests) {
    const own = sickEntries.filter((e) => e.note === requestEntryNote(req));
    if (own.length === 0) continue;
    let refundDays = 0;
    let refundMinutes = 0;
    for (const e of own) {
      const weight = req.halfDay ? 0.5 : vacationWeight(e.date, halfDays);
      refundDays += weight;
      const m = modelForDate(models, e.date);
      if (m) {
        refundMinutes +=
          weight === 0.5 ? halfDayMinutesFor(m, e.date) : targetMinutesForDate(e.date, m);
      }
    }
    const balanceKey = { userId_year: { userId, year: req.year } };
    await db.$transaction([
      db.timeEntry.deleteMany({ where: { id: { in: own.map((e) => e.id) } } }),
      db.vacationRequest.update({
        where: { id: req.id },
        data: { days: { decrement: refundDays } },
      }),
      req.useOvertime
        ? db.overtimeBalance.update({
            where: balanceKey,
            data: { consumedOvertimeMinutes: { decrement: refundMinutes } },
          })
        : db.vacationEntitlement.update({
            where: balanceKey,
            data: { consumedDays: { decrement: refundDays } },
          }),
    ]);
  }

  // Closure vacation: grouped per closure (its entitlement year is the start
  // year). Names aren't unique, so the closure must also cover the entry date.
  const byClosure = new Map<string, typeof sickEntries>();
  for (const e of sickEntries) {
    if (!e.note?.startsWith(CLOSURE_NOTE_PREFIX)) continue;
    byClosure.set(e.note, [...(byClosure.get(e.note) ?? []), e]);
  }
  for (const [note, closureEntries] of byClosure) {
    const closure = await db.businessClosure.findFirst({
      where: {
        name: note.slice(CLOSURE_NOTE_PREFIX.length),
        from: { lte: closureEntries[0].date },
        to: { gte: closureEntries[0].date },
      },
    });
    if (!closure) continue;
    const refundDays = closureEntries.reduce((sum, e) => sum + vacationWeight(e.date, halfDays), 0);
    await db.$transaction([
      db.timeEntry.deleteMany({ where: { id: { in: closureEntries.map((e) => e.id) } } }),
      db.vacationEntitlement.update({
        where: { userId_year: { userId, year: closure.from.getUTCFullYear() } },
        data: { consumedDays: { decrement: refundDays } },
      }),
    ]);
  }
}

export async function rebookVacationOnDays(opts: {
  userId: string;
  days: Date[];
  state: FederalState;
  timeZone: string;
}): Promise<void> {
  const { userId } = opts;
  if (opts.days.length === 0) return;
  const sorted = [...opts.days].sort((a, b) => a.getTime() - b.getTime());
  const from = sorted[0];
  const to = sorted[sorted.length - 1];

  // Days still covered by another sick note or already holding vacation stay as they are.
  const [blocked, settings] = await Promise.all([
    db.timeEntry.findMany({
      where: { userId, type: { in: ["SICK", "VACATION"] }, date: { gte: from, lte: to } },
      select: { date: true },
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);
  const blockedKeys = new Set(blocked.map((e) => dayKey(e.date)));
  const free = new Set(opts.days.map(dayKey).filter((k) => !blockedKeys.has(k)));
  if (free.size === 0) return;
  const halfDays = halfDayDateSet(settings);
  const charge = (range: { from: Date; to: Date; halfDay: boolean }) =>
    computeLeaveCharge({ userId, ...range, state: opts.state, timeZone: opts.timeZone, halfDays });

  // Closures first: a closure owns its days over an overlapping request.
  const choices = await db.closureChoice.findMany({
    where: {
      userId,
      choice: "VACATION",
      closure: { from: { lte: to }, to: { gte: from } },
    },
    include: { closure: true },
  });
  for (const { closure } of choices) {
    const c = await charge({ from: closure.from, to: closure.to, halfDay: false });
    const days = c.dayCharges.filter((d) => free.has(dayKey(d.date)));
    if (days.length === 0) continue;
    const year = closure.from.getUTCFullYear();
    await ensureEntitlement(userId, year);
    await db.$transaction([
      db.timeEntry.createMany({
        data: days.map((d) => ({
          userId,
          date: d.date,
          type: "VACATION" as const,
          source: "ADMIN" as const,
          note: `${CLOSURE_NOTE_PREFIX}${closure.name}`,
          breakMinutes: 0,
        })),
      }),
      db.vacationEntitlement.update({
        where: { userId_year: { userId, year } },
        data: { consumedDays: { increment: days.reduce((s, d) => s + d.days, 0) } },
      }),
    ]);
    for (const d of days) free.delete(dayKey(d.date));
  }

  const requests = await db.vacationRequest.findMany({
    where: { userId, status: "APPROVED", from: { lte: to }, to: { gte: from } },
  });
  for (const req of requests) {
    const c = await charge({ from: req.from, to: req.to, halfDay: req.halfDay });
    const days = c.dayCharges.filter((d) => free.has(dayKey(d.date)));
    if (days.length === 0) continue;
    const addDays = days.reduce((s, d) => s + d.days, 0);
    const addMinutes = days.reduce((s, d) => s + d.minutes, 0);
    const balanceKey = { userId_year: { userId, year: req.year } };
    if (!req.useOvertime) await ensureEntitlement(userId, req.year);
    await db.$transaction([
      db.timeEntry.createMany({
        data: days.map((d) => ({
          userId,
          date: d.date,
          type: "VACATION" as const,
          source: "ADMIN" as const,
          note: requestEntryNote(req),
          breakMinutes: 0,
        })),
      }),
      db.vacationRequest.update({
        where: { id: req.id },
        data: { days: { increment: addDays } },
      }),
      req.useOvertime
        ? db.overtimeBalance.upsert({
            where: balanceKey,
            create: { userId, year: req.year, consumedOvertimeMinutes: addMinutes },
            update: { consumedOvertimeMinutes: { increment: addMinutes } },
          })
        : db.vacationEntitlement.update({
            where: balanceKey,
            data: { consumedDays: { increment: addDays } },
          }),
    ]);
    for (const d of days) free.delete(dayKey(d.date));
  }
}

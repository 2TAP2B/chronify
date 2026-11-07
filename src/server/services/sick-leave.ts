import { db } from "@/lib/db";
import {
  CLOSURE_NOTE_PREFIX,
  halfDayDateSet,
  requestEntryNote,
  vacationWeight,
} from "@/lib/vacation/business-days";
import { computeLeaveCharge, ensureEntitlement } from "@/server/services/leave-balance";
import type { FederalState } from "@prisma/client";

/**
 * Sickness during vacation, § 9 BUrlG: "Erkrankt ein Arbeitnehmer während des
 * Urlaubs, so werden die durch ärztliches Zeugnis nachgewiesenen Tage der
 * Arbeitsunfähigkeit auf den Jahresurlaub nicht angerechnet."
 *
 * - Only days proven by a doctor's certificate count: a sick note's days up to
 *   its `aubUntil` (AU-Bescheinigung bis). Without an AU date nothing is given back.
 * - Only Erholungsurlaub counts: regular vacation requests and business-closure
 *   vacation. Time off against overtime (Freizeitausgleich), special leave
 *   (Sonderurlaub) and regeneration days are not vacation in that sense and stay
 *   consumed.
 *
 * The refund removes the VACATION entries and gives the days back to the
 * entitlement. When the AU coverage shrinks (sick note shortened, AU date
 * moved/removed, note deleted) the vacation is booked again on the freed days.
 * Callers hold the user's leave lock and call this after the sick note itself
 * was saved/deleted.
 */

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Sick business days proven by the AU certificate (up to `aubUntil`). */
export function auCoveredDays(businessDays: Date[], aubUntil: Date | null): Date[] {
  if (!aubUntil) return [];
  return businessDays.filter((d) => d.getTime() <= aubUntil.getTime());
}

/** Requests whose days § 9 BUrlG gives back: regular vacation paid from the entitlement. */
const refundableRequest = { status: "APPROVED", kind: "REGULAR", useOvertime: false } as const;

export async function refundVacationOnSickDays(userId: string, days: Date[]): Promise<void> {
  if (days.length === 0) return;
  const keys = new Set(days.map(dayKey));
  const sorted = [...days].sort((a, b) => a.getTime() - b.getTime());
  const from = sorted[0];
  const to = sorted[sorted.length - 1];

  const [entries, settings, requests] = await Promise.all([
    db.timeEntry.findMany({
      where: { userId, type: "VACATION", date: { gte: from, lte: to } },
      select: { id: true, date: true, note: true },
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    db.vacationRequest.findMany({
      where: { userId, ...refundableRequest, from: { lte: to }, to: { gte: from } },
    }),
  ]);
  const halfDays = halfDayDateSet(settings);
  const sickEntries = entries.filter((e) => keys.has(dayKey(e.date)));

  for (const req of requests) {
    const own = sickEntries.filter((e) => e.note === requestEntryNote(req));
    if (own.length === 0) continue;
    const refundDays = own.reduce(
      (sum, e) => sum + (req.halfDay ? 0.5 : vacationWeight(e.date, halfDays)),
      0
    );
    await db.$transaction([
      db.timeEntry.deleteMany({ where: { id: { in: own.map((e) => e.id) } } }),
      db.vacationRequest.update({
        where: { id: req.id },
        data: { days: { decrement: refundDays } },
      }),
      db.vacationEntitlement.update({
        where: { userId_year: { userId, year: req.year } },
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

  // Days already holding vacation, or still proven sick by another sick note's
  // AU, stay as they are.
  const [vacation, otherNotes, settings] = await Promise.all([
    db.timeEntry.findMany({
      where: { userId, type: "VACATION", date: { gte: from, lte: to } },
      select: { date: true },
    }),
    db.sickNote.findMany({
      where: { userId, aubUntil: { not: null, gte: from }, from: { lte: to }, to: { gte: from } },
      select: { from: true, to: true, aubUntil: true },
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);
  const blocked = new Set(vacation.map((e) => dayKey(e.date)));
  const stillSick = (d: Date) =>
    otherNotes.some(
      (n) => n.aubUntil && d >= n.from && d <= n.to && d.getTime() <= n.aubUntil.getTime()
    );
  const free = new Set(
    opts.days.filter((d) => !blocked.has(dayKey(d)) && !stillSick(d)).map(dayKey)
  );
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
    where: { userId, ...refundableRequest, from: { lte: to }, to: { gte: from } },
  });
  for (const req of requests) {
    const c = await charge({ from: req.from, to: req.to, halfDay: req.halfDay });
    const days = c.dayCharges.filter((d) => free.has(dayKey(d.date)));
    if (days.length === 0) continue;
    const addDays = days.reduce((s, d) => s + d.days, 0);
    await ensureEntitlement(userId, req.year);
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
      db.vacationEntitlement.update({
        where: { userId_year: { userId, year: req.year } },
        data: { consumedDays: { increment: addDays } },
      }),
    ]);
    for (const d of days) free.delete(dayKey(d.date));
  }
}

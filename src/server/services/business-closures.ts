import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";
import { notifyUser } from "@/server/services/notification";
import { notificationText } from "@/lib/notifications/server-texts";
import { toCalendarDate } from "@/lib/datetime";
import {
  CLOSURE_NOTE_PREFIX,
  makeHolidayResolver,
  businessDaysInRange,
  modelForDate,
  splitByWorkTarget,
  halfDayDateSet,
  vacationWeight,
  halfDayMinutesFor,
  requestEntryNote,
  type HolidayResolver,
} from "@/lib/vacation/business-days";
import type { FederalState } from "@prisma/client";
import { targetMinutesForDate } from "@/lib/overtime/calculate";
import {
  ensureEntitlement,
  vacationHeadroom,
  withLeaveLock,
  workingModelsInRange,
} from "@/server/services/leave-balance";

export class ClosureError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function requireAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN") throw new ClosureError("Forbidden", "FORBIDDEN", 403);
}

const BERLIN = "Europe/Berlin";

export const createClosureSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  name: z.string().min(1).max(200),
});

export type CreateClosureInput = z.infer<typeof createClosureSchema>;

/** Holidays for all involved federal states in one query; the resolver keys by state. */
async function buildResolver(from: Date, to: Date, states: string[]): Promise<HolidayResolver> {
  const unique = [...new Set(states)];
  const holidays = await db.publicHoliday.findMany({
    where: { date: { gte: from, lte: to }, federalState: { in: unique as never } },
  });
  return makeHolidayResolver(holidays);
}

type TakeOver = {
  req: { id: string; year: number; useOvertime: boolean };
  entryIds: string[];
  refundDays: number;
  refundMinutes: number;
};

/**
 * Approved request vacation the user already holds on `days`: per request the
 * entries and what they were charged (vacation days or overtime minutes).
 */
async function planTakeOver(
  userId: string,
  days: Date[],
  halfDaySet: Set<string>
): Promise<TakeOver[]> {
  if (days.length === 0) return [];
  const from = days[0];
  const to = days[days.length - 1];
  const requests = await db.vacationRequest.findMany({
    where: { userId, status: "APPROVED", from: { lte: to }, to: { gte: from } },
  });
  if (requests.length === 0) return [];
  const models = await workingModelsInRange(userId, from, to);

  const plan: TakeOver[] = [];
  for (const req of requests) {
    const covered = await db.timeEntry.findMany({
      where: {
        userId,
        type: "VACATION",
        date: { in: days.filter((d) => d >= req.from && d <= req.to) },
        note: requestEntryNote(req),
      },
      select: { id: true, date: true },
    });
    if (covered.length === 0) continue;
    let refundDays = 0;
    let refundMinutes = 0;
    for (const e of covered) {
      const weight = req.halfDay ? 0.5 : vacationWeight(e.date, halfDaySet);
      refundDays += weight;
      const m = modelForDate(models, e.date);
      if (m) {
        refundMinutes +=
          weight === 0.5 ? halfDayMinutesFor(m, e.date) : targetMinutesForDate(e.date, m);
      }
    }
    plan.push({ req, entryIds: covered.map((e) => e.id), refundDays, refundMinutes });
  }
  return plan;
}

/** Vacation days of `plan` that the closure refunds (and re-charges as closure days). */
function heldVacationDays(plan: TakeOver[]): number {
  return plan.reduce((sum, p) => sum + (p.req.useOvertime ? 0 : p.refundDays), 0);
}

/**
 * The closure takes over days the user already holds as approved request
 * vacation: the request's entries are removed and their charge refunded, so
 * every day is consumed once and stays covered by the closure if the request
 * is cancelled later.
 */
async function applyTakeOver(userId: string, plan: TakeOver[]): Promise<void> {
  for (const { req, entryIds, refundDays, refundMinutes } of plan) {
    const balanceKey = { userId_year: { userId, year: req.year } };
    await db.$transaction([
      db.timeEntry.deleteMany({ where: { id: { in: entryIds } } }),
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
}

/** Closure days that actually consume vacation for this user (model target > 0). */
async function consumableClosureDays(
  userId: string,
  state: FederalState,
  resolver: HolidayResolver,
  from: Date,
  to: Date
): Promise<Date[]> {
  const candidates = businessDaysInRange(from, to, state, resolver).businessDays;
  const models = await workingModelsInRange(userId, from, to);
  return splitByWorkTarget(candidates, models).consumed;
}

export async function listClosures(actor: SessionUser) {
  requireAdmin(actor);
  return db.businessClosure.findMany({
    orderBy: { from: "desc" },
    include: { _count: { select: { choices: true } } },
  });
}

export async function createClosure({
  actor,
  input,
}: {
  actor: SessionUser;
  input: CreateClosureInput;
}) {
  requireAdmin(actor);
  if (input.from > input.to) throw new ClosureError("from must be before to", "INVALID_RANGE");

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const year = input.from.getUTCFullYear();

  const activeUsers = await db.user.findMany({
    where: { active: true },
    select: { id: true, name: true, locale: true, federalState: true },
  });

  const resolver = await buildResolver(input.from, input.to, [
    settings.defaultFederalState,
    ...activeUsers.map((u) => u.federalState),
  ]);

  const businessDays = businessDaysInRange(
    input.from,
    input.to,
    settings.defaultFederalState,
    resolver
  ).businessDays;

  if (businessDays.length === 0)
    throw new ClosureError("No business days in range", "NO_BUSINESS_DAYS");

  const closure = await db.businessClosure.create({
    data: {
      from: input.from,
      to: input.to,
      name: input.name,
    },
  });

  for (const u of activeUsers) {
    // Days with target = 0 in the user's working model (e.g. 4-day week)
    // consume no vacation day; configured half days (24.12/31.12) charge 0.5.
    const consumedDays = await consumableClosureDays(
      u.id,
      u.federalState,
      resolver,
      input.from,
      input.to
    );
    const halfDaySet = halfDayDateSet(settings);
    const consumedDaysTotal = consumedDays.reduce(
      (sum, day) => sum + vacationWeight(day, halfDaySet),
      0
    );

    // Closure days are vacation as long as the user's vacation days cover them
    // (days already held as request vacation are re-charged, so they count as
    // covered); otherwise the whole closure is booked as overtime, which may go
    // negative — vacation days never do.
    const choice = await withLeaveLock(u.id, async () => {
      if (consumedDays.length === 0) return "VACATION" as const;
      const plan = await planTakeOver(u.id, consumedDays, halfDaySet);
      const headroom = await vacationHeadroom({ userId: u.id, year, includePending: true });
      if (consumedDaysTotal > headroom + heldVacationDays(plan)) return "OVERTIME" as const;

      await applyTakeOver(u.id, plan);
      await db.timeEntry.createMany({
        data: consumedDays.map((day) => ({
          userId: u.id,
          date: day,
          type: "VACATION" as const,
          source: "ADMIN" as const,
          note: `${CLOSURE_NOTE_PREFIX}${input.name}`,
          breakMinutes: 0,
        })),
      });
      await ensureEntitlement(u.id, year);
      await db.vacationEntitlement.update({
        where: { userId_year: { userId: u.id, year } },
        data: { consumedDays: { increment: consumedDaysTotal } },
      });
      return "VACATION" as const;
    });

    await db.closureChoice
      .create({
        data: { closureId: closure.id, userId: u.id, choice },
      })
      .catch(() => {});

    const locale: "de" | "en" = (u.locale ?? "de") === "en" ? "en" : "de";
    await notifyUser({
      userId: u.id,
      type: "CLOSURE_CHOICE",
      ...notificationText(choice === "OVERTIME" ? "closureOvertime" : "closureChoice", locale, {
        closureName: input.name,
        days: consumedDaysTotal,
      }),
      payload: {
        closureId: closure.id,
        closureName: input.name,
        businessDays: consumedDays.length,
      },
      url: "/de/closure-choices",
    });
  }

  await audit({
    actorId: actor.id,
    targetId: actor.id,
    action: "business_closure.create",
    entity: "BusinessClosure",
    entityId: closure.id,
    payload: {
      name: input.name,
      from: input.from.toISOString(),
      to: input.to.toISOString(),
      businessDays: businessDays.length,
      usersAffected: activeUsers.length,
    },
  });

  return closure;
}

export async function deleteClosure({
  actor,
  closureId,
}: {
  actor: SessionUser;
  closureId: string;
}) {
  requireAdmin(actor);
  const closure = await db.businessClosure.findUnique({ where: { id: closureId } });
  if (!closure) throw new ClosureError("Not found", "NOT_FOUND", 404);
  // Once a closure has started its days were actually off: deleting it would
  // turn them into unworked days (minus) for everyone. Only future closures go.
  if (closure.from.getTime() <= toCalendarDate(new Date(), BERLIN).getTime()) {
    throw new ClosureError("Closure already started", "CLOSURE_STARTED", 409);
  }

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const year = closure.from.getUTCFullYear();
  const note = `${CLOSURE_NOTE_PREFIX}${closure.name}`;

  // Reverse exactly what was granted: count the created entries per user
  // (stays correct even if a working model changed since creation).
  const entryWhere = {
    type: "VACATION" as const,
    source: "ADMIN" as const,
    note,
    date: { gte: closure.from, lte: closure.to },
  };
  const entries = await db.timeEntry.findMany({
    where: entryWhere,
    select: { userId: true, date: true },
  });
  const halfDaySet = halfDayDateSet(settings);
  const consumedByUser = new Map<string, number>();
  for (const e of entries) {
    consumedByUser.set(
      e.userId,
      (consumedByUser.get(e.userId) ?? 0) + vacationWeight(e.date, halfDaySet)
    );
  }
  await db.timeEntry.deleteMany({ where: entryWhere });

  for (const [userId, n] of consumedByUser) {
    await db.vacationEntitlement
      .update({
        where: { userId_year: { userId, year } },
        data: { consumedDays: { decrement: n } },
      })
      .catch(() => {});
  }
  // OVERTIME choices have no entries: their closure days were unworked days
  // (-target) and stay so — nothing stored to reverse.

  await db.businessClosure.delete({ where: { id: closureId } });

  await audit({
    actorId: actor.id,
    targetId: actor.id,
    action: "business_closure.delete",
    entity: "BusinessClosure",
    entityId: closureId,
  });
}

export async function listUserChoices(actor: SessionUser) {
  const choices = await db.closureChoice.findMany({
    where: { userId: actor.id },
    include: { closure: true },
    orderBy: { closure: { from: "desc" } },
  });
  return choices;
}

export async function updateChoice({
  actor,
  closureId,
  choice,
}: {
  actor: SessionUser;
  closureId: string;
  choice: "VACATION" | "OVERTIME";
}) {
  const existing = await db.closureChoice.findUnique({
    where: { closureId_userId: { closureId, userId: actor.id } },
    include: { closure: true },
  });
  if (!existing) throw new ClosureError("Not found", "NOT_FOUND", 404);
  if (existing.choice === choice) return existing;

  const closure = existing.closure;
  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const owner = await db.user.findUnique({
    where: { id: actor.id },
    select: { federalState: true },
  });
  const state = owner?.federalState ?? settings.defaultFederalState;
  const resolver = await buildResolver(closure.from, closure.to, [state]);
  const businessDays = businessDaysInRange(closure.from, closure.to, state, resolver).businessDays;
  // Days with target = 0 in the working model consume no vacation day;
  // configured half days (24.12/31.12) charge 0.5 days / half-day minutes.
  const models = await workingModelsInRange(actor.id, closure.from, closure.to);
  const { consumed } = splitByWorkTarget(businessDays, models);
  const halfDaySet = halfDayDateSet(settings);
  const consumedDaysTotal = consumed.reduce((sum, d) => sum + vacationWeight(d, halfDaySet), 0);
  const year = closure.from.getUTCFullYear();

  // Check + switch run under the user's leave lock. Overtime may go negative,
  // vacation days may not (pending requests reserve; days the closure takes
  // over from approved requests are re-charged, so they count as covered).
  return withLeaveLock(actor.id, async () => {
    if (choice === "OVERTIME" && existing.choice === "VACATION") {
      // Without its VACATION entries each closure day is an unworked day:
      // the day's target is debited from the overtime balance.
      // Refund only what is still booked (sick days may already have been
      // given back, BUrlG §9).
      const entryWhere = {
        userId: actor.id,
        type: "VACATION" as const,
        source: "ADMIN" as const,
        note: `${CLOSURE_NOTE_PREFIX}${closure.name}`,
        date: { gte: closure.from, lte: closure.to },
      };
      const booked = await db.timeEntry.findMany({ where: entryWhere, select: { date: true } });
      const refundDays = booked.reduce((sum, e) => sum + vacationWeight(e.date, halfDaySet), 0);
      await db.timeEntry.deleteMany({ where: entryWhere });
      await db.vacationEntitlement
        .update({
          where: { userId_year: { userId: actor.id, year } },
          data: { consumedDays: { decrement: refundDays } },
        })
        .catch(() => {});
    } else if (choice === "VACATION" && existing.choice === "OVERTIME") {
      const plan = await planTakeOver(actor.id, consumed, halfDaySet);
      const headroom = await vacationHeadroom({ userId: actor.id, year, includePending: true });
      if (consumedDaysTotal > headroom + heldVacationDays(plan)) {
        throw new ClosureError("Not enough vacation days", "INSUFFICIENT_ENTITLEMENT", 403);
      }
      await applyTakeOver(actor.id, plan);
      await db.timeEntry.createMany({
        data: consumed.map((day) => ({
          userId: actor.id,
          date: day,
          type: "VACATION" as const,
          source: "ADMIN" as const,
          note: `${CLOSURE_NOTE_PREFIX}${closure.name}`,
          breakMinutes: 0,
        })),
      });
      await ensureEntitlement(actor.id, year);
      await db.vacationEntitlement.update({
        where: { userId_year: { userId: actor.id, year } },
        data: { consumedDays: { increment: consumedDaysTotal } },
      });
    }

    return db.closureChoice.update({
      where: { id: existing.id },
      data: { choice },
    });
  });
}

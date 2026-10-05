import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";
import { notifyUser } from "@/server/services/notification";
import { notificationText } from "@/lib/notifications/server-texts";
import { toCalendarDate } from "@/lib/datetime";
import {
  makeHolidayResolver,
  businessDaysInRange,
  modelForDate,
  splitByWorkTarget,
  type HolidayResolver,
} from "@/lib/vacation/business-days";
import { targetMinutesForDate } from "@/lib/overtime/calculate";
import type { FederalState } from "@prisma/client";

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

export function workingModelsInRange(userId: string, from: Date, to: Date) {
  return db.workingModel.findMany({
    where: {
      userId,
      validFrom: { lte: to },
      OR: [{ validTo: null }, { validTo: { gte: from } }],
    },
    orderBy: { validFrom: "desc" },
  });
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
    // consume no vacation day.
    const consumedDays = await consumableClosureDays(
      u.id,
      u.federalState,
      resolver,
      input.from,
      input.to
    );

    if (consumedDays.length > 0) {
      await db.timeEntry.createMany({
        data: consumedDays.map((day) => ({
          userId: u.id,
          date: day,
          type: "VACATION" as const,
          source: "ADMIN" as const,
          note: `Schließtag: ${input.name}`,
          breakMinutes: 0,
        })),
      });

      await db.vacationEntitlement.upsert({
        where: { userId_year: { userId: u.id, year } },
        create: {
          userId: u.id,
          year,
          totalDays: settings.defaultVacationDays,
          consumedDays: consumedDays.length,
        },
        update: {
          consumedDays: { increment: consumedDays.length },
        },
      });
    }

    await db.closureChoice
      .create({
        data: { closureId: closure.id, userId: u.id, choice: "VACATION" },
      })
      .catch(() => {});

    const locale: "de" | "en" = (u.locale ?? "de") === "en" ? "en" : "de";
    await notifyUser({
      userId: u.id,
      type: "CLOSURE_CHOICE",
      ...notificationText("closureChoice", locale, {
        closureName: input.name,
        days: consumedDays.length,
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

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const year = closure.from.getUTCFullYear();
  const note = `Schließtag: ${closure.name}`;

  // Reverse exactly what was granted: count the created entries per user
  // (stays correct even if a working model changed since creation).
  const entryWhere = {
    type: "VACATION" as const,
    source: "ADMIN" as const,
    note,
    date: { gte: closure.from, lte: closure.to },
  };
  const entries = await db.timeEntry.findMany({ where: entryWhere, select: { userId: true } });
  const consumedByUser = new Map<string, number>();
  for (const e of entries) {
    consumedByUser.set(e.userId, (consumedByUser.get(e.userId) ?? 0) + 1);
  }
  await db.timeEntry.deleteMany({ where: entryWhere });

  for (const [userId, n] of consumedByUser) {
    await db.vacationEntitlement
      .upsert({
        where: { userId_year: { userId, year } },
        create: {
          userId,
          year,
          totalDays: settings.defaultVacationDays,
          consumedDays: -n,
        },
        update: {
          consumedDays: { decrement: n },
        },
      })
      .catch(() => {});
  }

  // Restore overtime for users who had compensated the closure with overtime.
  const overtimeChoices = await db.closureChoice.findMany({
    where: { closureId: closure.id, choice: "OVERTIME" },
  });
  if (overtimeChoices.length > 0) {
    const overtimeUsers = await db.user.findMany({
      where: { id: { in: overtimeChoices.map((c) => c.userId) } },
      select: { id: true, federalState: true },
    });
    const resolver = await buildResolver(closure.from, closure.to, [
      settings.defaultFederalState,
      ...overtimeUsers.map((u) => u.federalState),
    ]);
    for (const u of overtimeUsers) {
      const days = businessDaysInRange(
        closure.from,
        closure.to,
        u.federalState,
        resolver
      ).businessDays;
      const models = await workingModelsInRange(u.id, closure.from, closure.to);
      const overtimeMinutes = days.reduce((sum, d) => {
        const m = modelForDate(models, d);
        return m ? sum + targetMinutesForDate(d, m) : sum;
      }, 0);
      if (overtimeMinutes <= 0) continue;
      await db.overtimeBalance
        .upsert({
          where: { userId_year: { userId: u.id, year } },
          create: {
            userId: u.id,
            year,
            carriedOverMinutes: 0,
            computedMinutes: overtimeMinutes,
          },
          update: {
            computedMinutes: { increment: overtimeMinutes },
          },
        })
        .catch(() => {});
    }
  }

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
  // Days with target = 0 in the working model consume no vacation day.
  const models = await workingModelsInRange(actor.id, closure.from, closure.to);
  const { consumed } = splitByWorkTarget(businessDays, models);
  const totalOvertimeMinutes = businessDays.reduce((sum, d) => {
    const m = modelForDate(models, d);
    return m ? sum + targetMinutesForDate(d, m) : sum;
  }, 0);

  if (choice === "OVERTIME" && existing.choice === "VACATION") {
    await db.timeEntry.deleteMany({
      where: {
        userId: actor.id,
        type: "VACATION",
        source: "ADMIN",
        note: `Schließtag: ${closure.name}`,
        date: { gte: closure.from, lte: closure.to },
      },
    });

    await db.vacationEntitlement
      .upsert({
        where: { userId_year: { userId: actor.id, year: closure.from.getUTCFullYear() } },
        create: {
          userId: actor.id,
          year: closure.from.getUTCFullYear(),
          totalDays: settings.defaultVacationDays,
          consumedDays: -consumed.length,
        },
        update: {
          consumedDays: { decrement: consumed.length },
        },
      })
      .catch(() => {});

    await db.overtimeBalance.upsert({
      where: { userId_year: { userId: actor.id, year: closure.from.getUTCFullYear() } },
      create: {
        userId: actor.id,
        year: closure.from.getUTCFullYear(),
        carriedOverMinutes: 0,
        computedMinutes: -totalOvertimeMinutes,
      },
      update: {
        computedMinutes: { decrement: totalOvertimeMinutes },
      },
    });
  } else if (choice === "VACATION" && existing.choice === "OVERTIME") {
    await db.timeEntry.createMany({
      data: consumed.map((day) => ({
        userId: actor.id,
        date: day,
        type: "VACATION" as const,
        source: "ADMIN" as const,
        note: `Schließtag: ${closure.name}`,
        breakMinutes: 0,
      })),
    });

    await db.vacationEntitlement.upsert({
      where: { userId_year: { userId: actor.id, year: closure.from.getUTCFullYear() } },
      create: {
        userId: actor.id,
        year: closure.from.getUTCFullYear(),
        totalDays: settings.defaultVacationDays,
        consumedDays: consumed.length,
      },
      update: {
        consumedDays: { increment: consumed.length },
      },
    });

    await db.overtimeBalance.upsert({
      where: { userId_year: { userId: actor.id, year: closure.from.getUTCFullYear() } },
      create: {
        userId: actor.id,
        year: closure.from.getUTCFullYear(),
        carriedOverMinutes: 0,
        computedMinutes: totalOvertimeMinutes,
      },
      update: {
        computedMinutes: { increment: totalOvertimeMinutes },
      },
    });
  }

  const updated = await db.closureChoice.update({
    where: { id: existing.id },
    data: { choice },
  });

  return updated;
}

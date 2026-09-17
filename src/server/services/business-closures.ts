import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";
import { notifyUser } from "@/server/services/notification";
import { notificationText } from "@/lib/notifications/server-texts";
import { toCalendarDate, addDaysUtc, isSameCalendarDay } from "@/lib/datetime";
import { makeHolidayResolver, isWeekend } from "@/lib/vacation/business-days";

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

function businessDaysInRange(from: Date, to: Date, federalState: string): Date[] {
  const days: Date[] = [];
  let cur = toCalendarDate(from, BERLIN);
  const end = toCalendarDate(to, BERLIN);
  while (cur.getTime() <= end.getTime()) {
    if (!isWeekend(cur)) days.push(new Date(cur));
    cur = addDaysUtc(cur, 1);
  }
  return days;
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
  const federalState = settings.defaultFederalState;

  const businessDays = businessDaysInRange(input.from, input.to, federalState);
  if (businessDays.length === 0)
    throw new ClosureError("No business days in range", "NO_BUSINESS_DAYS");

  const closure = await db.businessClosure.create({
    data: {
      from: input.from,
      to: input.to,
      name: input.name,
    },
  });

  const activeUsers = await db.user.findMany({
    where: { active: true },
    select: { id: true, name: true, locale: true },
  });

  for (const day of businessDays) {
    await db.timeEntry.createMany({
      data: activeUsers.map((u) => ({
        userId: u.id,
        date: day,
        type: "VACATION" as const,
        source: "ADMIN" as const,
        note: `Schließtag: ${input.name}`,
        breakMinutes: 0,
      })),
    });
  }

  for (const u of activeUsers) {
    await db.vacationEntitlement.upsert({
      where: { userId_year: { userId: u.id, year: input.from.getUTCFullYear() } },
      create: {
        userId: u.id,
        year: input.from.getUTCFullYear(),
        totalDays: settings.defaultVacationDays,
        consumedDays: businessDays.length,
      },
      update: {
        consumedDays: { increment: businessDays.length },
      },
    });

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
        days: businessDays.length,
      }),
      payload: {
        closureId: closure.id,
        closureName: input.name,
        businessDays: businessDays.length,
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

  const businessDays = businessDaysInRange(closure.from, closure.to, "DE_NW");

  await db.timeEntry.deleteMany({
    where: {
      type: "VACATION",
      source: "ADMIN",
      note: `Schließtag: ${closure.name}`,
      date: { gte: closure.from, lte: closure.to },
    },
  });

  const activeUsers = await db.user.findMany({ where: { active: true }, select: { id: true } });
  for (const u of activeUsers) {
    await db.vacationEntitlement
      .upsert({
        where: { userId_year: { userId: u.id, year: closure.from.getUTCFullYear() } },
        create: {
          userId: u.id,
          year: closure.from.getUTCFullYear(),
          totalDays: 30,
          consumedDays: -businessDays.length,
        },
        update: {
          consumedDays: { decrement: businessDays.length },
        },
      })
      .catch(() => {});
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
  const businessDays = businessDaysInRange(closure.from, closure.to, settings.defaultFederalState);

  if (choice === "OVERTIME" && existing.choice === "VACATION") {
    await db.timeEntry.deleteMany({
      where: {
        userId: actor.id,
        type: "VACATION",
        source: "ADMIN",
        note: `Schließtag: ${closure.name}`,
      },
    });

    await db.vacationEntitlement
      .upsert({
        where: { userId_year: { userId: actor.id, year: closure.from.getUTCFullYear() } },
        create: {
          userId: actor.id,
          year: closure.from.getUTCFullYear(),
          totalDays: settings.defaultVacationDays,
          consumedDays: -businessDays.length,
        },
        update: {
          consumedDays: { decrement: businessDays.length },
        },
      })
      .catch(() => {});

    const workingModel = await db.workingModel.findFirst({
      where: {
        userId: actor.id,
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
      },
      orderBy: { validFrom: "desc" },
    });

    const dayMinutes = workingModel
      ? [
          workingModel.mondayMinutes,
          workingModel.tuesdayMinutes,
          workingModel.wednesdayMinutes,
          workingModel.thursdayMinutes,
          workingModel.fridayMinutes,
          workingModel.saturdayMinutes,
          workingModel.sundayMinutes,
        ]
      : [0, 0, 0, 0, 0, 0, 0];

    let totalOvertimeMinutes = 0;
    for (const day of businessDays) {
      const dow = day.getUTCDay();
      const idx = dow === 0 ? 6 : dow - 1;
      totalOvertimeMinutes += dayMinutes[idx];
    }

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
      data: businessDays.map((day) => ({
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
        consumedDays: businessDays.length,
      },
      update: {
        consumedDays: { increment: businessDays.length },
      },
    });

    const workingModel = await db.workingModel.findFirst({
      where: {
        userId: actor.id,
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
      },
      orderBy: { validFrom: "desc" },
    });

    const dayMinutes = workingModel
      ? [
          workingModel.mondayMinutes,
          workingModel.tuesdayMinutes,
          workingModel.wednesdayMinutes,
          workingModel.thursdayMinutes,
          workingModel.fridayMinutes,
          workingModel.saturdayMinutes,
          workingModel.sundayMinutes,
        ]
      : [0, 0, 0, 0, 0, 0, 0];

    let totalOvertimeMinutes = 0;
    for (const day of businessDays) {
      const dow = day.getUTCDay();
      const idx = dow === 0 ? 6 : dow - 1;
      totalOvertimeMinutes += dayMinutes[idx];
    }

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

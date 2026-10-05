import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";
import { notifyUser } from "@/server/services/notification";
import { sendMail } from "@/server/services/mail";
import { vacationRequestedAdminEmail } from "@/lib/email-templates";
import { computeYearOvertime } from "@/server/services/overtime";
import {
  businessDaysInRange,
  makeHolidayResolver,
  overlapsExisting,
  splitByWorkTarget,
  modelForDate,
} from "@/lib/vacation/business-days";
import { toCalendarDate } from "@/lib/datetime";
import { notificationText } from "@/lib/notifications/server-texts";
import { targetMinutesForDate } from "@/lib/overtime/calculate";
import { workingModelsInRange } from "@/server/services/business-closures";
import type { FederalState, VacationKind, VacationRequest, VacationStatus } from "@prisma/client";

/** Extra vacation days per year for users with regeneration leave enabled. */
export const REGENERATION_EXTRA_DAYS = 2;

export class VacationError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
  }
}

export type VacationCreateInput = {
  from: Date;
  to: Date;
  note?: string | null;
  year?: number;
  useOvertime?: boolean;
  kind?: VacationKind;
  /** Admin-only: assign a leave to another user (regeneration flow). */
  targetUserId?: string;
};

/** Regeneration quota status: pending + approved REGENERATION leave counts as used. */
export async function getRegenerationStatus(userId: string, year: number) {
  const [user, agg] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { regeneration: true } }),
    db.vacationRequest.aggregate({
      where: { userId, year, kind: "REGENERATION", status: { in: ["PENDING", "APPROVED"] } },
      _sum: { days: true },
    }),
  ]);
  const total = user?.regeneration ? REGENERATION_EXTRA_DAYS : 0;
  const used = agg._sum.days ?? 0;
  return { enabled: !!user?.regeneration, total, used, available: Math.max(0, total - used) };
}

export async function listVacationRequests(opts: {
  actor: SessionUser;
  targetUserId?: string;
  year?: number;
  status?: VacationStatus;
}): Promise<{ requests: VacationRequest[]; targetUserId: string }> {
  const userId = resolveTarget(opts.actor, opts.targetUserId);
  const where: Record<string, unknown> = {};
  if (opts.actor.role !== "ADMIN" || opts.targetUserId) where.userId = userId;
  if (opts.year) where.year = opts.year;
  if (opts.status) where.status = opts.status;
  const requests = await db.vacationRequest.findMany({
    where: where as never,
    orderBy: { from: "desc" },
  });
  return { requests, targetUserId: userId };
}

export async function listPendingForApproval(actor: SessionUser): Promise<VacationRequest[]> {
  if (actor.role !== "ADMIN") {
    throw new VacationError("Forbidden", "FORBIDDEN", 403);
  }
  return db.vacationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { from: "asc" },
  });
}

export async function createVacationRequest(opts: {
  actor: SessionUser;
  input: VacationCreateInput;
}): Promise<VacationRequest> {
  const { actor } = opts;
  const from = opts.input.from;
  const to = opts.input.to;
  if (from.getTime() > to.getTime()) {
    throw new VacationError("from > to", "INVALID_RANGE");
  }

  const kind = opts.input.kind ?? "REGULAR";
  if (opts.input.targetUserId && actor.role !== "ADMIN") {
    throw new VacationError("Forbidden", "FORBIDDEN", 403);
  }
  const ownerUserId =
    opts.input.targetUserId && actor.role === "ADMIN" ? opts.input.targetUserId : actor.id;
  const ctx = await getUserContext(ownerUserId);
  const state = ctx.user.federalState;
  const year = opts.input.year ?? from.getUTCFullYear();

  // Resolve holidays within the range
  const holidays = await db.publicHoliday.findMany({
    where: {
      federalState: state,
      date: { gte: from, lte: to },
    },
  });
  const resolver = makeHolidayResolver(holidays);
  const { businessDays, totalDays, holidayCount, weekendCount } = businessDaysInRange(
    from,
    to,
    state,
    resolver
  );

  // Days with target = 0 in the working model (e.g. 4-day week) consume no
  // vacation day.
  const models = await workingModelsInRange(ownerUserId, from, to);
  const { consumed: spendableDays } = splitByWorkTarget(businessDays, models);

  if (spendableDays.length === 0) {
    throw new VacationError(
      `Range has no work days (weekends: ${weekendCount}, holidays: ${holidayCount}, non-working (0 h): ${businessDays.length}, total: ${totalDays})`,
      "NO_BUSINESS_DAYS"
    );
  }

  if (kind === "REGENERATION") {
    const regen = await getRegenerationStatus(ownerUserId, year);
    if (!regen.enabled || regen.available < spendableDays.length) {
      throw new VacationError("No regeneration days available", "NO_REGENERATION", 403);
    }
  }

  // Check overlap with existing (still active) requests; rejected or
  // cancelled requests must not block re-application.
  const existing = await db.vacationRequest.findMany({
    where: { userId: ownerUserId, year, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (overlapsExisting(from, to, existing)) {
    throw new VacationError("Range overlaps an existing request", "OVERLAP");
  }

  // Entitlement check (falls back to org default when no row exists yet)
  const [entitlement, settings] = await Promise.all([
    db.vacationEntitlement.findUnique({
      where: { userId_year: { userId: ownerUserId, year } },
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);
  const totalDays_ =
    (entitlement?.totalDays ?? settings.defaultVacationDays) +
    (ctx.user.regeneration ? REGENERATION_EXTRA_DAYS : 0);
  const carriedOverDays = entitlement?.carriedOverDays ?? 0;
  const consumedDays = entitlement?.consumedDays ?? 0;
  const available = totalDays_ + carriedOverDays - consumedDays;

  const useOvertime = opts.input.useOvertime ?? false;

  if (useOvertime) {
    // Check overtime balance instead of vacation entitlement
    const { computation } = await computeYearOvertime({
      userId: ownerUserId,
      year,
      timeZone: ctx.timeZone,
    });
    if (computation.balanceMs <= 0) {
      throw new VacationError("No overtime balance available", "INSUFFICIENT_OVERTIME", 403);
    }
  } else if (spendableDays.length > available) {
    throw new VacationError(
      `Insufficient entitlement: requested ${spendableDays.length} days, available ${available}`,
      "INSUFFICIENT_ENTITLEMENT",
      403
    );
  }

  const created = await db.vacationRequest.create({
    data: {
      userId: ownerUserId,
      from,
      to,
      days: spendableDays.length,
      status: "PENDING",
      year,
      note: opts.input.note ?? null,
      kind,
      useOvertime,
    },
  });

  // Notify admins
  const admins = await db.user.findMany({
    where: { role: "ADMIN", active: true, vacationMailEnabled: true },
    select: { id: true, email: true, name: true, locale: true },
  });
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((a) => {
        const locale: "de" | "en" = (a.locale ?? "de") === "en" ? "en" : "de";
        const requesterName = ctx.user.name ?? ctx.user.email ?? "";
        const text = notificationText("vacationRequested", locale, {
          actorName: requesterName,
          days: spendableDays.length,
          fromDate: from.toISOString().slice(0, 10),
          toDate: to.toISOString().slice(0, 10),
        });
        return {
          userId: a.id,
          type: "VACATION_REQUESTED",
          title: text.title,
          body: text.body,
          payload: {
            requestId: created.id,
            userId: ownerUserId,
            actorName: requesterName,
            days: spendableDays.length,
            fromDate: from.toISOString().slice(0, 10),
            toDate: to.toISOString().slice(0, 10),
          },
          channel: "APP",
        };
      }),
    });

    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const appName = process.env.APP_NAME ?? "Chronify";
    const approvalUrl = `${appUrl}/de/admin/vacation-approvals`;

    for (const admin of admins) {
      const mailContent = vacationRequestedAdminEmail({
        locale: (admin.locale ?? "de") as "de" | "en",
        appName,
        adminName: admin.name,
        requesterName: ctx.user.name ?? ctx.user.email ?? "User",
        fromDate: from.toISOString().slice(0, 10),
        toDate: to.toISOString().slice(0, 10),
        days: spendableDays.length,
        approvalUrl,
      });
      await sendMail({
        to: admin.email,
        subject: mailContent.subject,
        html: mailContent.html,
        text: mailContent.text,
      }).catch(() => {});
    }
  }

  await audit({
    actorId: actor.id,
    targetId: ownerUserId,
    action: "vacation_request.create",
    entity: "VacationRequest",
    entityId: created.id,
    payload: { from: from.toISOString(), to: to.toISOString(), days: spendableDays.length, year },
  });

  return created;
}

export async function approveVacationRequest(opts: {
  actor: SessionUser;
  requestId: string;
  approverNote?: string | null;
}): Promise<VacationRequest> {
  if (opts.actor.role !== "ADMIN") {
    throw new VacationError("Forbidden", "FORBIDDEN", 403);
  }

  const claim = await db.vacationRequest.updateMany({
    where: { id: opts.requestId, status: "PENDING" },
    data: {
      status: "APPROVED",
      approverId: opts.actor.id,
      approverNote: opts.approverNote ?? null,
    },
  });
  if (claim.count === 0) {
    const existing = await db.vacationRequest.findUnique({ where: { id: opts.requestId } });
    if (!existing) throw new VacationError("Not found", "NOT_FOUND", 404);
    throw new VacationError(`Request is ${existing.status}`, "NOT_PENDING", 409);
  }

  const req = await db.vacationRequest.findUniqueOrThrow({ where: { id: opts.requestId } });

  const ctx = await getUserContext(req.userId);
  const state = ctx.user.federalState;
  const holidays = await db.publicHoliday.findMany({
    where: { federalState: state, date: { gte: req.from, lte: req.to } },
  });
  const resolver = makeHolidayResolver(holidays);
  const { businessDays } = businessDaysInRange(req.from, req.to, state, resolver);
  // Days with target = 0 in the working model (e.g. 4-day week) consume no
  // vacation day — both for entries and entitlement accounting.
  const models = await workingModelsInRange(req.userId, req.from, req.to);
  const { consumed: spendableDays } = splitByWorkTarget(businessDays, models);
  const days = spendableDays.length;

  if (req.useOvertime) {
    // Deduct from overtime balance instead of vacation entitlement
    const consumedMinutes = businessDays.reduce((sum, d) => {
      const model = modelForDate(models, d);
      if (!model) return sum;
      return sum + targetMinutesForDate(d, model);
    }, 0);

    await db.$transaction([
      db.overtimeBalance.upsert({
        where: { userId_year: { userId: req.userId, year: req.year } },
        create: {
          userId: req.userId,
          year: req.year,
          consumedOvertimeMinutes: consumedMinutes,
        },
        update: {
          consumedOvertimeMinutes: { increment: consumedMinutes },
        },
      }),
      db.timeEntry.createMany({
        data: spendableDays.map((d) => ({
          userId: req.userId,
          date: toCalendarDate(d, ctx.timeZone),
          startAt: null,
          endAt: null,
          breakMinutes: 0,
          type: "VACATION",
          source: "ADMIN",
          note: `Urlaub (Überstunden) ${req.from.toISOString().slice(0, 10)} – ${req.to.toISOString().slice(0, 10)}`,
        })),
      }),
    ]);
  } else {
    await db.$transaction([
      db.vacationEntitlement.upsert({
        where: { userId_year: { userId: req.userId, year: req.year } },
        create: {
          userId: req.userId,
          year: req.year,
          totalDays: (await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }))
            .defaultVacationDays,
          consumedDays: days,
        },
        update: {
          consumedDays: { increment: days },
        },
      }),
      db.timeEntry.createMany({
        data: spendableDays.map((d) => ({
          userId: req.userId,
          date: toCalendarDate(d, ctx.timeZone),
          startAt: null,
          endAt: null,
          breakMinutes: 0,
          type: "VACATION",
          source: "ADMIN",
          note: `Urlaub ${req.from.toISOString().slice(0, 10)} – ${req.to.toISOString().slice(0, 10)}`,
        })),
      }),
    ]);
  }

  await notifyUser({
    userId: req.userId,
    type: "VACATION_APPROVED",
    ...notificationText("vacationApproved", (ctx.user.locale ?? "de") === "en" ? "en" : "de", {
      fromDate: req.from.toISOString().slice(0, 10),
      toDate: req.to.toISOString().slice(0, 10),
    }),
    payload: {
      requestId: req.id,
      fromDate: req.from.toISOString().slice(0, 10),
      toDate: req.to.toISOString().slice(0, 10),
    },
    url: "/de/vacation",
    email: {
      template: "vacation_approved",
      locale: (ctx.user.locale ?? "de") as "de" | "en",
      recipientName: ctx.user.name,
      appName: process.env.APP_NAME ?? "Chronify",
      vars: {
        fromDate: req.from.toISOString().slice(0, 10),
        toDate: req.to.toISOString().slice(0, 10),
        days,
      },
    },
  });

  await audit({
    actorId: opts.actor.id,
    targetId: req.userId,
    action: "vacation_request.approve",
    entity: "VacationRequest",
    entityId: req.id,
    payload: { days, year: req.year },
  });

  return req;
}

export async function rejectVacationRequest(opts: {
  actor: SessionUser;
  requestId: string;
  approverNote?: string | null;
}): Promise<VacationRequest> {
  if (opts.actor.role !== "ADMIN") {
    throw new VacationError("Forbidden", "FORBIDDEN", 403);
  }
  const req = await db.vacationRequest.findUnique({ where: { id: opts.requestId } });
  if (!req) throw new VacationError("Not found", "NOT_FOUND", 404);
  if (req.status !== "PENDING") {
    throw new VacationError(`Request is ${req.status}`, "NOT_PENDING", 409);
  }
  const updated = await db.vacationRequest.update({
    where: { id: opts.requestId },
    data: {
      status: "REJECTED",
      approverId: opts.actor.id,
      approverNote: opts.approverNote ?? null,
    },
  });

  const rejectCtx = await getUserContext(req.userId);

  await notifyUser({
    userId: req.userId,
    type: "VACATION_REJECTED",
    ...notificationText(
      "vacationRejected",
      (rejectCtx.user.locale ?? "de") === "en" ? "en" : "de",
      {
        fromDate: req.from.toISOString().slice(0, 10),
        toDate: req.to.toISOString().slice(0, 10),
      }
    ),
    payload: {
      requestId: req.id,
      fromDate: req.from.toISOString().slice(0, 10),
      toDate: req.to.toISOString().slice(0, 10),
    },
    url: "/de/vacation",
    email: {
      template: "vacation_rejected",
      locale: (rejectCtx.user.locale ?? "de") as "de" | "en",
      recipientName: rejectCtx.user.name,
      appName: process.env.APP_NAME ?? "Chronify",
      vars: {
        fromDate: req.from.toISOString().slice(0, 10),
        toDate: req.to.toISOString().slice(0, 10),
        reason: opts.approverNote ?? "",
      },
    },
  });

  await audit({
    actorId: opts.actor.id,
    targetId: req.userId,
    action: "vacation_request.reject",
    entity: "VacationRequest",
    entityId: req.id,
  });

  return updated;
}

export async function cancelVacationRequest(opts: {
  actor: SessionUser;
  requestId: string;
}): Promise<VacationRequest> {
  const req = await db.vacationRequest.findUnique({ where: { id: opts.requestId } });
  if (!req) throw new VacationError("Not found", "NOT_FOUND", 404);
  // Owner or admin can cancel
  if (req.userId !== opts.actor.id && opts.actor.role !== "ADMIN") {
    throw new VacationError("Forbidden", "FORBIDDEN", 403);
  }
  if (req.status === "CANCELLED") {
    throw new VacationError("Already cancelled", "ALREADY_CANCELLED", 409);
  }
  if (req.status === "REJECTED") {
    throw new VacationError("Cannot reject a rejected request", "BAD_STATE", 409);
  }
  // Approved leave is consumed time: owners may only cancel while the
  // vacation still lies ahead of today's date. Admins keep full control.
  if (req.status === "APPROVED" && opts.actor.id === req.userId && opts.actor.role !== "ADMIN") {
    const todayBerlin = toCalendarDate(new Date(), "Europe/Berlin");
    if (req.from.getTime() < todayBerlin.getTime()) {
      throw new VacationError(
        "Approved vacation in the past cannot be cancelled by the user",
        "APPROVED_PAST",
        403
      );
    }
  }

  // If was approved, reverse the consumption
  if (req.status === "APPROVED") {
    if (req.useOvertime) {
      // Restore consumed overtime: recompute the consumed minutes from the vacation days
      const ctx2 = await getUserContext(req.userId);
      const state2 = ctx2.user.federalState;
      const holidays2 = await db.publicHoliday.findMany({
        where: { federalState: state2, date: { gte: req.from, lte: req.to } },
      });
      const resolver2 = makeHolidayResolver(holidays2);
      const { businessDays: bd } = businessDaysInRange(req.from, req.to, state2, resolver2);
      const models2 = await workingModelsInRange(req.userId, req.from, req.to);
      const consumedMinutes = bd.reduce((sum, d) => {
        const model = modelForDate(models2, d);
        if (!model) return sum;
        return sum + targetMinutesForDate(d, model);
      }, 0);
      await db.overtimeBalance.update({
        where: { userId_year: { userId: req.userId, year: req.year } },
        data: { consumedOvertimeMinutes: { decrement: consumedMinutes } },
      });
    } else {
      await db.vacationEntitlement.update({
        where: { userId_year: { userId: req.userId, year: req.year } },
        data: { consumedDays: { decrement: req.days } },
      });
    }
    await db.timeEntry.deleteMany({
      where: {
        userId: req.userId,
        type: "VACATION",
        date: { gte: req.from, lte: req.to },
      },
    });
  }

  const updated = await db.vacationRequest.update({
    where: { id: opts.requestId },
    data: { status: "CANCELLED" },
  });

  await audit({
    actorId: opts.actor.id,
    targetId: req.userId,
    action: "vacation_request.cancel",
    entity: "VacationRequest",
    entityId: req.id,
  });

  return updated;
}

export async function getVacationEntitlementView(opts: {
  actor: SessionUser;
  targetUserId?: string;
  year?: number;
}) {
  const userId = resolveTarget(opts.actor, opts.targetUserId);
  const year = opts.year ?? new Date().getUTCFullYear();
  const [entitlement, settings, regeneration] = await Promise.all([
    db.vacationEntitlement.findUnique({
      where: { userId_year: { userId, year } },
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    getRegenerationStatus(userId, year),
  ]);
  const baseDays = entitlement?.totalDays ?? settings.defaultVacationDays;
  const totalDays = baseDays + (regeneration.enabled ? regeneration.total : 0);
  const carriedOverDays = entitlement?.carriedOverDays ?? 0;
  const consumedDays = entitlement?.consumedDays ?? 0;
  return {
    userId,
    year,
    totalDays,
    baseTotalDays: baseDays,
    carriedOverDays,
    consumedDays,
    availableDays: totalDays + carriedOverDays - consumedDays,
    regeneration,
  };
}

function resolveTarget(actor: SessionUser, targetUserId?: string): string {
  if (targetUserId && targetUserId !== actor.id && actor.role !== "ADMIN") {
    throw new VacationError("Forbidden", "FORBIDDEN", 403);
  }
  return targetUserId ?? actor.id;
}

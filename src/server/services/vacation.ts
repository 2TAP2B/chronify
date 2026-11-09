import { db } from "@/lib/db";
import { audit, getUserContext, type SessionUser } from "@/server/context";
import { notifyUser } from "@/server/services/notification";
import { sendMail } from "@/server/services/mail";
import { vacationRequestedAdminEmail } from "@/lib/email-templates";
import {
  CLOSURE_NOTE_PREFIX,
  halfDayDateSet,
  halfDayMinutesFor,
  modelForDate,
  overlapsExisting,
  requestEntryNote,
  vacationWeight,
} from "@/lib/vacation/business-days";
import { toCalendarDate, isSameCalendarDay, currentYear, formatCalendarDate } from "@/lib/datetime";
import { notificationText } from "@/lib/notifications/server-texts";
import {
  REGENERATION_EXTRA_DAYS,
  computeLeaveCharge,
  ensureEntitlement,
  vacationAccount,
  vacationHeadroom,
  withLeaveLock,
  workingModelsInRange,
} from "@/server/services/leave-balance";
import { targetMinutesForDate } from "@/lib/overtime/calculate";
import type { FederalState, VacationKind, VacationRequest, VacationStatus } from "@prisma/client";

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
  /** Half-day request: only valid for single-day ranges; consumes 0.5. */
  halfDay?: boolean;
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
  const halfDay = opts.input.halfDay ?? false;
  if (opts.input.targetUserId && actor.role !== "ADMIN") {
    throw new VacationError("Forbidden", "FORBIDDEN", 403);
  }
  const ownerUserId =
    opts.input.targetUserId && actor.role === "ADMIN" ? opts.input.targetUserId : actor.id;
  const ctx = await getUserContext(ownerUserId);
  if (halfDay && !isSameCalendarDay(from, to, ctx.timeZone)) {
    throw new VacationError("Half-day requests must cover a single day", "INVALID_RANGE");
  }
  const state = ctx.user.federalState;
  const year = opts.input.year ?? from.getUTCFullYear();

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const halfDays = halfDayDateSet(settings);
  // Only working days of the user's model, no holidays, nothing a closure
  // already covers; half days (request or 24.12/31.12) weigh 0.5.
  const charge = await computeLeaveCharge({
    userId: ownerUserId,
    from,
    to,
    halfDay,
    state,
    timeZone: ctx.timeZone,
    halfDays,
  });
  if (charge.spendableDays.length === 0) {
    throw new VacationError(
      `Range has no work days (weekends: ${charge.weekendCount}, holidays: ${charge.holidayCount}, non-working (0 h): ${charge.zeroTargetCount}, total: ${charge.totalDays})`,
      "NO_BUSINESS_DAYS"
    );
  }
  const vacationDays = charge.days;

  if (kind === "REGENERATION") {
    const regen = await getRegenerationStatus(ownerUserId, year);
    if (!regen.enabled || regen.available < vacationDays) {
      throw new VacationError("No regeneration days available", "NO_REGENERATION", 403);
    }
  }

  const useOvertime = opts.input.useOvertime ?? false;
  const created = await withLeaveLock(ownerUserId, async () => {
    // Check overlap with existing (still active) requests; rejected or
    // cancelled requests must not block re-application.
    const existing = await db.vacationRequest.findMany({
      where: { userId: ownerUserId, year, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (overlapsExisting(from, to, existing)) {
      throw new VacationError("Range overlaps an existing request", "OVERLAP");
    }

    // Vacation days may not go negative (pending requests reserve); overtime may.
    if (!useOvertime) {
      const headroom = await vacationHeadroom({ userId: ownerUserId, year, includePending: true });
      if (vacationDays > headroom) {
        throw new VacationError(
          `Insufficient entitlement: requested ${vacationDays} days, available ${headroom}`,
          "INSUFFICIENT_ENTITLEMENT",
          403
        );
      }
    }

    return db.vacationRequest.create({
      data: {
        userId: ownerUserId,
        from,
        to,
        days: vacationDays,
        status: "PENDING",
        year,
        note: opts.input.note ?? null,
        kind,
        halfDay,
        useOvertime,
      },
    });
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
          days: vacationDays,
          fromDate: formatCalendarDate(from, locale),
          toDate: formatCalendarDate(to, locale),
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
            days: vacationDays,
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
      const adminLocale: "de" | "en" = admin.locale === "en" ? "en" : "de";
      const mailContent = vacationRequestedAdminEmail({
        locale: adminLocale,
        appName,
        adminName: admin.name,
        requesterName: ctx.user.name ?? ctx.user.email ?? "User",
        fromDate: formatCalendarDate(from, adminLocale),
        toDate: formatCalendarDate(to, adminLocale),
        days: vacationDays,
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
    payload: { from: from.toISOString(), to: to.toISOString(), days: vacationDays, year },
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

  const target = await db.vacationRequest.findUnique({ where: { id: opts.requestId } });
  if (!target) throw new VacationError("Not found", "NOT_FOUND", 404);
  // Check + claim + booking run under the user's leave lock.
  const { req, days, ctx } = await withLeaveLock(target.userId, async () => {
    const pending = await db.vacationRequest.findUniqueOrThrow({ where: { id: opts.requestId } });
    if (pending.status !== "PENDING") {
      throw new VacationError(`Request is ${pending.status}`, "NOT_PENDING", 409);
    }

    // Recompute the charge (models/holidays/closures may have changed since the
    // request) and re-check vacation days against the approved balance.
    const ctx = await getUserContext(pending.userId);
    const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    const halfDays = halfDayDateSet(settings);
    const charge = await computeLeaveCharge({
      userId: pending.userId,
      from: pending.from,
      to: pending.to,
      halfDay: pending.halfDay,
      state: ctx.user.federalState,
      timeZone: ctx.timeZone,
      halfDays,
    });
    if (!pending.useOvertime) {
      const headroom = await vacationHeadroom({
        userId: pending.userId,
        year: pending.year,
        includePending: false,
      });
      if (charge.days > headroom) {
        throw new VacationError(
          `Insufficient entitlement: requested ${charge.days} days, available ${headroom}`,
          "INSUFFICIENT_ENTITLEMENT",
          403
        );
      }
      await ensureEntitlement(pending.userId, pending.year);
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
      throw new VacationError("Request is no longer pending", "NOT_PENDING", 409);
    }

    const req = await db.vacationRequest.findUniqueOrThrow({ where: { id: opts.requestId } });
    const { spendableDays, days } = charge;

    if (req.useOvertime) {
      // Deduct from overtime balance instead of vacation entitlement
      // Half days charge the model's half-day value instead of the full target.
      const consumedMinutes = charge.minutes;

      await db.$transaction([
        // Persist the charged amount so cancel/closure refunds stay symmetric.
        db.vacationRequest.update({ where: { id: req.id }, data: { days } }),
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
            note: requestEntryNote(req),
          })),
        }),
      ]);
    } else {
      await db.$transaction([
        db.vacationRequest.update({ where: { id: req.id }, data: { days } }),
        db.vacationEntitlement.update({
          where: { userId_year: { userId: req.userId, year: req.year } },
          data: { consumedDays: { increment: days } },
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
            note: requestEntryNote(req),
          })),
        }),
      ]);
    }
    return { req, days, ctx };
  });

  const locale: "de" | "en" = ctx.user.locale === "en" ? "en" : "de";
  await notifyUser({
    userId: req.userId,
    type: "VACATION_APPROVED",
    ...notificationText("vacationApproved", locale, {
      fromDate: formatCalendarDate(req.from, locale),
      toDate: formatCalendarDate(req.to, locale),
    }),
    payload: {
      requestId: req.id,
      fromDate: req.from.toISOString().slice(0, 10),
      toDate: req.to.toISOString().slice(0, 10),
    },
    url: "/de/vacation",
    email: {
      template: "vacation_approved",
      locale,
      recipientName: ctx.user.name,
      appName: process.env.APP_NAME ?? "Chronify",
      vars: {
        fromDate: formatCalendarDate(req.from, locale),
        toDate: formatCalendarDate(req.to, locale),
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

  return { ...req, days };
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

  const rejectLocale: "de" | "en" = rejectCtx.user.locale === "en" ? "en" : "de";
  await notifyUser({
    userId: req.userId,
    type: "VACATION_REJECTED",
    ...notificationText("vacationRejected", rejectLocale, {
      fromDate: formatCalendarDate(req.from, rejectLocale),
      toDate: formatCalendarDate(req.to, rejectLocale),
    }),
    payload: {
      requestId: req.id,
      fromDate: req.from.toISOString().slice(0, 10),
      toDate: req.to.toISOString().slice(0, 10),
    },
    url: "/de/vacation",
    email: {
      template: "vacation_rejected",
      locale: rejectLocale,
      recipientName: rejectCtx.user.name,
      appName: process.env.APP_NAME ?? "Chronify",
      vars: {
        fromDate: formatCalendarDate(req.from, rejectLocale),
        toDate: formatCalendarDate(req.to, rejectLocale),
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
      // Refund exactly the days this request still holds: days taken over by a
      // business closure were already refunded there (see takeOverRequestDays).
      const ctx2 = await getUserContext(req.userId);
      const ownEntries = await db.timeEntry.findMany({
        where: {
          userId: req.userId,
          type: "VACATION",
          note: requestEntryNote(req),
          date: { gte: req.from, lte: req.to },
        },
        select: { date: true },
      });
      const models2 = await workingModelsInRange(req.userId, req.from, req.to);
      // Mirror the approve-time half-day charging (same weightOf rules).
      const settings2 = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
      const halfDays2 = halfDayDateSet(settings2);
      const halfDayReq = req.halfDay && isSameCalendarDay(req.from, req.to, ctx2.timeZone);
      const consumedMinutes = ownEntries.reduce((sum, { date: d }) => {
        const model = modelForDate(models2, d);
        if (!model) return sum;
        const weight =
          halfDayReq && isSameCalendarDay(req.from, d, ctx2.timeZone)
            ? 0.5
            : vacationWeight(d, halfDays2);
        return (
          sum + (weight === 0.5 ? halfDayMinutesFor(model, d) : targetMinutesForDate(d, model))
        );
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
    // Only this request's entries; closure-owned days stay covered.
    await db.timeEntry.deleteMany({
      where: {
        userId: req.userId,
        type: "VACATION",
        date: { gte: req.from, lte: req.to },
        NOT: { note: { startsWith: CLOSURE_NOTE_PREFIX } },
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
  const year = opts.year ?? currentYear();
  const [account, regeneration] = await Promise.all([
    vacationAccount(userId, year),
    getRegenerationStatus(userId, year),
  ]);
  return {
    userId,
    year,
    totalDays: account.baseTotalDays + account.regenerationDays,
    baseTotalDays: account.baseTotalDays,
    carriedOverDays: account.carriedOverDays,
    consumedDays: account.consumedDays,
    availableDays: account.availableDays,
    regeneration,
  };
}

function resolveTarget(actor: SessionUser, targetUserId?: string): string {
  if (targetUserId && targetUserId !== actor.id && actor.role !== "ADMIN") {
    throw new VacationError("Forbidden", "FORBIDDEN", 403);
  }
  return targetUserId ?? actor.id;
}

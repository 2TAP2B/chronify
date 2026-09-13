import { db } from "@/lib/db";
import { type SessionUser } from "@/server/context";

export type GdprExportData = {
  exportedAt: string;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    role: string;
    locale: string;
    federalState: string;
    timezone: string | null;
    breakMode: string;
    hireDate: string | null;
    nfcCardId: string | null;
    active: boolean;
    createdAt: string;
  };
  workingModels: Array<{
    validFrom: string;
    validTo: string | null;
    weeklyTargetMinutes: number;
    mondayMinutes: number;
    tuesdayMinutes: number;
    wednesdayMinutes: number;
    thursdayMinutes: number;
    fridayMinutes: number;
    saturdayMinutes: number;
    sundayMinutes: number;
  }>;
  timeEntries: Array<{
    id: string;
    date: string;
    startAt: string | null;
    endAt: string | null;
    breakMinutes: number;
    type: string;
    source: string;
    note: string | null;
    lockedAt: string | null;
    createdAt: string;
  }>;
  vacationRequests: Array<{
    id: string;
    from: string;
    to: string;
    days: number;
    status: string;
    year: number;
    note: string | null;
    approverNote: string | null;
    useOvertime: boolean;
    createdAt: string;
  }>;
  vacationEntitlements: Array<{
    year: number;
    totalDays: number;
    carriedOverDays: number;
    consumedDays: number;
  }>;
  sickNotes: Array<{
    id: string;
    from: string;
    to: string;
    days: number;
    hasCertificate: boolean;
    aubUntil: string | null;
    note: string | null;
    createdAt: string;
  }>;
  overtimeBalances: Array<{
    year: number;
    carriedOverMinutes: number;
    computedMinutes: number;
    lockedAt: string | null;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    channel: string;
    readAt: string | null;
    createdAt: string;
  }>;
  auditLogs: Array<{
    action: string;
    entity: string;
    createdAt: string;
  }>;
};

export async function exportUserData(actor: SessionUser): Promise<GdprExportData> {
  const userId = actor.id;

  const [
    user,
    workingModels,
    timeEntries,
    vacationRequests,
    vacationEntitlements,
    sickNotes,
    overtimeBalances,
    notifications,
    auditLogs,
  ] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.workingModel.findMany({ where: { userId }, orderBy: { validFrom: "asc" } }),
    db.timeEntry.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.vacationRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    db.vacationEntitlement.findMany({ where: { userId }, orderBy: { year: "asc" } }),
    db.sickNote.findMany({
      where: { userId },
      orderBy: { from: "desc" },
      select: {
        id: true,
        from: true,
        to: true,
        days: true,
        certificateUrl: true,
        aubUntil: true,
        note: true,
        createdAt: true,
      },
    }),
    db.overtimeBalance.findMany({ where: { userId }, orderBy: { year: "asc" } }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        channel: true,
        readAt: true,
        createdAt: true,
      },
    }),
    db.auditLog.findMany({
      where: { OR: [{ actorId: userId }, { targetId: userId }] },
      orderBy: { at: "desc" },
      take: 500,
      select: { action: true, entity: true, at: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      locale: user.locale,
      federalState: user.federalState,
      timezone: user.timezone,
      breakMode: user.breakMode,
      hireDate: user.hireDate?.toISOString() ?? null,
      nfcCardId: user.nfcCardId,
      active: user.active,
      createdAt: user.createdAt.toISOString(),
    },
    workingModels: workingModels.map((m) => ({
      validFrom: m.validFrom.toISOString(),
      validTo: m.validTo?.toISOString() ?? null,
      weeklyTargetMinutes: m.weeklyTargetMinutes,
      mondayMinutes: m.mondayMinutes,
      tuesdayMinutes: m.tuesdayMinutes,
      wednesdayMinutes: m.wednesdayMinutes,
      thursdayMinutes: m.thursdayMinutes,
      fridayMinutes: m.fridayMinutes,
      saturdayMinutes: m.saturdayMinutes,
      sundayMinutes: m.sundayMinutes,
    })),
    timeEntries: timeEntries.map((te) => ({
      id: te.id,
      date: te.date.toISOString(),
      startAt: te.startAt?.toISOString() ?? null,
      endAt: te.endAt?.toISOString() ?? null,
      breakMinutes: te.breakMinutes,
      type: te.type,
      source: te.source,
      note: te.note,
      lockedAt: te.lockedAt?.toISOString() ?? null,
      createdAt: te.createdAt.toISOString(),
    })),
    vacationRequests: vacationRequests.map((v) => ({
      id: v.id,
      from: v.from.toISOString(),
      to: v.to.toISOString(),
      days: v.days,
      status: v.status,
      year: v.year,
      note: v.note,
      approverNote: v.approverNote,
      useOvertime: v.useOvertime,
      createdAt: v.createdAt.toISOString(),
    })),
    vacationEntitlements: vacationEntitlements.map((e) => ({
      year: e.year,
      totalDays: e.totalDays,
      carriedOverDays: e.carriedOverDays,
      consumedDays: e.consumedDays,
    })),
    sickNotes: sickNotes.map((s) => ({
      id: s.id,
      from: s.from.toISOString(),
      to: s.to.toISOString(),
      days: s.days,
      hasCertificate: !!s.certificateUrl,
      aubUntil: s.aubUntil?.toISOString() ?? null,
      note: s.note,
      createdAt: s.createdAt.toISOString(),
    })),
    overtimeBalances: overtimeBalances.map((o) => ({
      year: o.year,
      carriedOverMinutes: o.carriedOverMinutes,
      computedMinutes: o.computedMinutes,
      lockedAt: o.lockedAt?.toISOString() ?? null,
    })),
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      channel: n.channel,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    auditLogs: auditLogs.map((a) => ({
      action: a.action,
      entity: a.entity,
      createdAt: a.at.toISOString(),
    })),
  };
}

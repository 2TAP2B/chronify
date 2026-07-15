import { db } from "@/lib/db";
import { getOrgSettings, audit, type SessionUser } from "@/server/context";
import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

export type RetentionStats = {
  timeEntries: number;
  vacationRequests: number;
  sickNotes: number;
  auditLogs: number;
  notifications: number;
  inactiveUsers: number;
};

export async function getRetentionStats(): Promise<RetentionStats> {
  const settings = await getOrgSettings();
  const now = new Date();

  const retentionCutoff = new Date(Date.UTC(now.getUTCFullYear() - settings.retentionYears, 0, 1));
  const sickNoteCutoff = new Date(now.getTime() - settings.sickNoteRetentionMonths * 30 * 24 * 60 * 60 * 1000);
  const auditCutoff = new Date(now.getTime() - settings.auditLogRetentionMonths * 30 * 24 * 60 * 60 * 1000);
  const notifCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [timeEntries, vacationRequests, sickNotes, auditLogs, notifications, inactiveUsers] = await Promise.all([
    db.timeEntry.count({ where: { date: { lt: retentionCutoff } } }),
    db.vacationRequest.count({ where: { createdAt: { lt: retentionCutoff } } }),
    db.sickNote.count({ where: { createdAt: { lt: sickNoteCutoff } } }),
    db.auditLog.count({ where: { at: { lt: auditCutoff } } }),
    db.notification.count({ where: { createdAt: { lt: notifCutoff } } }),
    db.user.count({
      where: {
        active: false,
        createdAt: { lt: retentionCutoff },
      },
    }),
  ]);

  return { timeEntries, vacationRequests, sickNotes, auditLogs, notifications, inactiveUsers };
}

export async function runRetentionCleanup(
  actor: SessionUser,
  opts: { dryRun?: boolean } = {}
): Promise<RetentionStats & { dryRun: boolean }> {
  const settings = await getOrgSettings();
  const now = new Date();
  const dryRun = opts.dryRun ?? false;

  const retentionCutoff = new Date(Date.UTC(now.getUTCFullYear() - settings.retentionYears, 0, 1));
  const sickNoteCutoff = new Date(now.getTime() - settings.sickNoteRetentionMonths * 30 * 24 * 60 * 60 * 1000);
  const auditCutoff = new Date(now.getTime() - settings.auditLogRetentionMonths * 30 * 24 * 60 * 60 * 1000);
  const notifCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const stats: RetentionStats = {
    timeEntries: 0,
    vacationRequests: 0,
    sickNotes: 0,
    auditLogs: 0,
    notifications: 0,
    inactiveUsers: 0,
  };

  if (dryRun) {
    const s = await getRetentionStats();
    return { ...s, dryRun: true };
  }

  // Delete old time entries
  const te = await db.timeEntry.deleteMany({ where: { date: { lt: retentionCutoff } } });
  stats.timeEntries = te.count;

  // Delete old vacation requests
  const vr = await db.vacationRequest.deleteMany({ where: { createdAt: { lt: retentionCutoff } } });
  stats.vacationRequests = vr.count;

  // Delete old sick notes + certificate files
  const oldSickNotes = await db.sickNote.findMany({
    where: { createdAt: { lt: sickNoteCutoff } },
    select: { id: true, certificateUrl: true },
  });
  for (const sn of oldSickNotes) {
    if (sn.certificateUrl) {
      const filePath = sn.certificateUrl.replace(/^file:/, "");
      if (existsSync(filePath)) {
        try { await unlink(filePath); } catch { /* ignore */ }
      }
    }
  }
  if (oldSickNotes.length > 0) {
    const sn = await db.sickNote.deleteMany({ where: { createdAt: { lt: sickNoteCutoff } } });
    stats.sickNotes = sn.count;
  }

  // Delete old audit logs
  const al = await db.auditLog.deleteMany({ where: { at: { lt: auditCutoff } } });
  stats.auditLogs = al.count;

  // Delete old notifications
  const nf = await db.notification.deleteMany({ where: { createdAt: { lt: notifCutoff } } });
  stats.notifications = nf.count;

  // Anonymize inactive users older than retention
  const inactiveUsers = await db.user.findMany({
    where: {
      active: false,
      createdAt: { lt: retentionCutoff },
    },
    select: { id: true },
  });
  for (const u of inactiveUsers) {
    await db.user.update({
      where: { id: u.id },
      data: {
        name: "Gelöscht",
        firstName: null,
        lastName: null,
        email: `deleted_${u.id}@anonymized.local`,
        passwordHash: "",
        nfcCardId: null,
      },
    });
  }
  stats.inactiveUsers = inactiveUsers.length;

  await audit({
    actorId: actor.id,
    action: "gdpr.retention_cleanup",
    entity: "System",
    payload: {
      timeEntries: stats.timeEntries,
      vacationRequests: stats.vacationRequests,
      sickNotes: stats.sickNotes,
      auditLogs: stats.auditLogs,
      notifications: stats.notifications,
      anonymizedUsers: stats.inactiveUsers,
    },
  });

  return { ...stats, dryRun: false };
}

export async function anonymizeUser(actor: SessionUser, userId: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.active) {
    throw new Error("Cannot anonymize an active user. Deactivate first.");
  }

  // Delete certificate files
  const sickNotes = await db.sickNote.findMany({
    where: { userId },
    select: { certificateUrl: true },
  });
  for (const sn of sickNotes) {
    if (sn.certificateUrl) {
      const filePath = sn.certificateUrl.replace(/^file:/, "");
      if (existsSync(filePath)) {
        try { await unlink(filePath); } catch { /* ignore */ }
      }
    }
  }

  await db.user.update({
    where: { id: userId },
    data: {
      name: "Gelöscht",
      firstName: null,
      lastName: null,
      email: `deleted_${userId}@anonymized.local`,
      passwordHash: "",
      nfcCardId: null,
    },
  });

  // Delete notifications, push subscriptions, timer session
  await db.notification.deleteMany({ where: { userId } });
  await db.pushSubscription.deleteMany({ where: { userId } });
  await db.timerSession.deleteMany({ where: { userId } });

  await audit({
    actorId: actor.id,
    targetId: userId,
    action: "gdpr.anonymize_user",
    entity: "User",
    entityId: userId,
  });
}
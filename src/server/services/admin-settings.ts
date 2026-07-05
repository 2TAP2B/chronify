import { db } from "@/lib/db";
import { audit, type SessionUser } from "@/server/context";
import { z } from "zod";
import type { BreakMode, FederalState } from "@prisma/client";

export function requireAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export const updateSettingsSchema = z.object({
  defaultFederalState: z.enum([
    "DE_BW", "DE_BY", "DE_BE", "DE_BB", "DE_HB", "DE_HE", "DE_HH", "DE_ME",
    "DE_MV", "DE_NI", "DE_NW", "DE_RP", "DE_SL", "DE_SN", "DE_ST", "DE_SH", "DE_TH",
  ]).optional(),
  overtimeCarryoverCutoffMonth: z.number().int().min(1).max(12).optional(),
  overtimeCarryoverCutoffDay: z.number().int().min(1).max(31).optional(),
  timeEntryLockWindowDays: z.number().int().min(0).max(365).optional(),
  autoBreakDefault: z.enum(["AUTO", "MANUAL"]).optional(),
  defaultVacationDays: z.number().min(0).max(60).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export async function getSettings(actor: SessionUser) {
  requireAdmin(actor);
  return db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
}

export async function updateSettings(opts: {
  actor: SessionUser;
  input: UpdateSettingsInput;
}) {
  requireAdmin(opts.actor);
  const updated = await db.orgSettings.update({
    where: { id: "singleton" },
    data: opts.input as never,
  });
  await audit({
    actorId: opts.actor.id,
    action: "org_settings.update",
    entity: "OrgSettings",
    entityId: "singleton",
    payload: { changes: Object.keys(opts.input) },
  });
  return updated;
}

export async function listAuditLog(opts: {
  actor: SessionUser;
  entity?: string;
  actorId?: string;
  limit?: number;
  offset?: number;
}) {
  requireAdmin(opts.actor);
  const where: Record<string, unknown> = {};
  if (opts.entity) where.entity = opts.entity;
  if (opts.actorId) where.actorId = opts.actorId;
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where: where as never,
      orderBy: { at: "desc" },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
      include: {
        actor: { select: { name: true, email: true } },
        target: { select: { name: true, email: true } },
      },
    }),
    db.auditLog.count({ where: where as never }),
  ]);
  return { entries, total };
}

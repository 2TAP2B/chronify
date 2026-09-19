import { db } from "@/lib/db";
import { audit, type SessionUser } from "@/server/context";
import { z } from "zod";
import type { BreakMode, FederalState, OrgSettings } from "@prisma/client";

export function requireAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export const updateSettingsSchema = z.object({
  defaultFederalState: z
    .enum([
      "DE_BW",
      "DE_BY",
      "DE_BE",
      "DE_BB",
      "DE_HB",
      "DE_HE",
      "DE_HH",
      "DE_ME",
      "DE_MV",
      "DE_NI",
      "DE_NW",
      "DE_RP",
      "DE_SL",
      "DE_SN",
      "DE_ST",
      "DE_SH",
      "DE_TH",
    ])
    .optional(),
  overtimeCarryoverCutoffMonth: z.number().int().min(1).max(12).nullable().optional(),
  overtimeCarryoverCutoffDay: z.number().int().min(1).max(31).nullable().optional(),
  overtimeCarryoverCutoffEnabled: z.boolean().optional(),
  timeEntryLockWindowDays: z.number().int().min(0).max(365).optional(),
  autoBreakDefault: z.enum(["AUTO", "MANUAL"]).optional(),
  defaultVacationDays: z.number().min(0).max(60).optional(),
  appName: z.string().max(50).optional(),
  appLogo: z.string().nullable().optional(),
  loginImage: z.string().nullable().optional(),
  loginQuote: z.string().max(200).nullable().optional(),
  loginQuoteAuthor: z.string().max(50).nullable().optional(),
  passwordLoginDisabled: z.boolean().optional(),
  smtpHost: z.string().max(255).nullable().optional(),
  smtpPort: z.number().int().min(1).max(65535).nullable().optional(),
  smtpUser: z.string().max(255).nullable().optional(),
  smtpPassword: z.string().max(255).nullable().optional(),
  smtpFrom: z.string().max(255).nullable().optional(),
  smtpTls: z.boolean().nullable().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export type SettingsView = Omit<OrgSettings, "smtpPassword"> & {
  smtpPassword: string | null;
  smtpSource: "env" | "db" | "none";
  smtpHasPassword: boolean;
};

export async function getSettings(actor: SessionUser) {
  requireAdmin(actor);
  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const hasEnvSmtp = !!process.env.SMTP_HOST;
  return {
    ...settings,
    // smtpPassword is write-only: never returned to the client.
    smtpPassword: null,
    smtpSource: hasEnvSmtp
      ? ("env" as const)
      : settings.smtpHost
        ? ("db" as const)
        : ("none" as const),
    smtpFrom: hasEnvSmtp && process.env.SMTP_FROM ? process.env.SMTP_FROM : settings.smtpFrom,
  } as SettingsView;
}

export async function updateSettings(opts: { actor: SessionUser; input: UpdateSettingsInput }) {
  requireAdmin(opts.actor);
  const smtpSourceEnv = !!process.env.SMTP_HOST;
  if (smtpSourceEnv) {
    const smtpKeys = Object.keys(opts.input).filter((k) => k.startsWith("smtp"));
    if (smtpKeys.length > 0) {
      throw new Error("SMTP_MANAGED_BY_ENV");
    }
  }
  if (opts.input.passwordLoginDisabled === true && !oidcConfigured()) {
    // Guard against lockout: with password login off, SSO is the only way in.
    throw new Error("OIDC_NOT_CONFIGURED");
  }
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

/** OIDC (Pocket-ID) availability is env-driven; used by the password-login gate. */
export function oidcConfigured(): boolean {
  return !!(
    process.env.OIDC_ISSUER &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET
  );
}

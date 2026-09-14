import { db } from "@/lib/db";
import { audit, type SessionUser } from "@/server/context";
import { z } from "zod";
import type { ReportAutomationRunKind } from "@prisma/client";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { toCalendarDate } from "@/lib/datetime";
import {
  computePeriod,
  buildReportFileName,
  isSafeSubfolder,
  type ReportAutomationFrequencyValue,
} from "@/lib/reports/automation-period";
import { gatherReportData, toPdf } from "@/server/services/reports";

export type ReportAutomationConfig = {
  enabled: boolean;
  frequency: "WEEKLY" | "MONTHLY";
  weeklyDay: number;
  monthlyDay: number;
  runHour: number;
  scope: "ALL" | "SELECTED";
  userIds: string[];
  subfolder: string;
};

export const updateReportAutomationSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["WEEKLY", "MONTHLY"]),
  weeklyDay: z.number().int().min(1).max(7),
  monthlyDay: z.number().int().min(1).max(31),
  runHour: z.number().int().min(0).max(23),
  scope: z.enum(["ALL", "SELECTED"]),
  userIds: z.array(z.string().min(1)).max(200),
  subfolder: z.string().max(200).refine(isSafeSubfolder, { message: "Invalid subfolder" }),
});

export type UpdateReportAutomationInput = z.infer<typeof updateReportAutomationSchema>;

type ReportAutomationRow = {
  enabled: boolean;
  frequency: "WEEKLY" | "MONTHLY";
  weeklyDay: number;
  monthlyDay: number;
  runHour: number;
  scope: "ALL" | "SELECTED";
  userIds: unknown;
  subfolder: string;
};

export function toConfig(row: ReportAutomationRow): ReportAutomationConfig {
  return {
    enabled: row.enabled,
    frequency: row.frequency,
    weeklyDay: row.weeklyDay,
    monthlyDay: row.monthlyDay,
    runHour: row.runHour,
    scope: row.scope,
    userIds: Array.isArray(row.userIds) ? (row.userIds as string[]) : [],
    subfolder: row.subfolder,
  };
}

function requireAdmin(actor: { role: string }) {
  if (actor.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

async function readOrCreateConfig(): Promise<ReportAutomationRow> {
  const existing = await db.reportAutomation.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return db.reportAutomation.create({ data: { id: "singleton" } });
}

export async function getReportAutomation(actor: SessionUser): Promise<ReportAutomationConfig> {
  requireAdmin(actor);
  return toConfig(await readOrCreateConfig());
}

export async function updateReportAutomation(opts: {
  actor: SessionUser;
  input: UpdateReportAutomationInput;
}): Promise<ReportAutomationConfig> {
  requireAdmin(opts.actor);
  if (!isSafeSubfolder(opts.input.subfolder)) {
    throw new Error("Invalid subfolder");
  }
  const updated = await db.reportAutomation.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...opts.input },
    update: { ...opts.input },
  });
  await audit({
    actorId: opts.actor.id,
    action: "report_automation.update",
    entity: "ReportAutomation",
    entityId: "singleton",
    payload: { changes: Object.keys(opts.input) },
  });
  return toConfig(updated);
}

export async function listReportAutomationRuns(opts: { actor: SessionUser; limit?: number }) {
  requireAdmin(opts.actor);
  return db.reportAutomationRun.findMany({
    orderBy: { startedAt: "desc" },
    take: opts.limit ?? 10,
  });
}

export function exportBaseDir(): string | null {
  const base = process.env.REPORTS_EXPORT_DIR;
  return base && base.trim() !== "" ? base : null;
}

export type AutomationRunResult = {
  status: "SUCCESS" | "PARTIAL" | "ERROR";
  periodKey: string;
  generated: number;
  failed: number;
  error: string | null;
  files: string[];
};

/**
 * Generates one PDF (previous week/month) per target user into
 * `REPORTS_EXPORT_DIR(+subfolder)`. `periodKey` acts as an idempotency key for
 * SCHEDULED runs: a (kind, periodKey) row is created before any work starts,
 * so a retry after an app restart can never produce the file twice.
 */
export async function runReportAutomation(opts: {
  actor: SessionUser;
  kind: "MANUAL" | "SCHEDULED";
  now?: Date;
  configOverride?: ReportAutomationConfig;
}): Promise<AutomationRunResult> {
  requireAdmin(opts.actor);
  const now = opts.now ?? new Date();
  const config = opts.configOverride ?? toConfig(await readOrCreateConfig());

  // The due check runs on the Europe/Berlin calendar; derive the period from
  // the same calendar so a Berlin Monday 00:xx (still Sunday in UTC) cannot
  // produce the wrong week boundary.
  const period = computePeriod(
    config.frequency as ReportAutomationFrequencyValue,
    toCalendarDate(now, "Europe/Berlin")
  );

  const createRun = () => {
    const periodKey =
      opts.kind === "MANUAL" ? periodKeyForManual(period.periodKey) : period.periodKey;
    return db.reportAutomationRun.create({
      data: {
        kind: opts.kind as ReportAutomationRunKind,
        periodKey,
        // Placeholder until the run finishes; the final update overwrites it.
        // If the process crashes mid-run the row stays ERROR, which keeps the
        // (kind, periodKey) idempotency intact (no duplicate PDF export).
        status: "ERROR",
      },
    });
  };

  let run;
  try {
    run = await createRun();
  } catch (e) {
    // Unique violation on (kind, periodKey): the scheduled run already happened
    if (opts.kind === "SCHEDULED" && (e as { code?: string }).code === "P2002") {
      return {
        status: "SUCCESS",
        periodKey: period.periodKey,
        generated: 0,
        failed: 0,
        error: null,
        files: [],
      };
    }
    throw e;
  }

  const errorHints: string[] = [];
  let generated = 0;
  let failed = 0;

  try {
    const baseDir = exportBaseDir();
    if (!baseDir) {
      throw new Error("REPORTS_EXPORT_DIR is not configured");
    }

    const targets = await pickTargetUsers(config);

    const outDir = config.subfolder === "" ? baseDir : path.join(baseDir, config.subfolder);
    // Defense in depth: verify the final dir stays inside the configured base.
    const resolvedBase = path.resolve(baseDir);
    const resolvedDir = path.resolve(outDir);
    const insideBase =
      resolvedDir === resolvedBase || resolvedDir.startsWith(resolvedBase + path.sep);
    if (!insideBase) {
      throw new Error("Invalid output location");
    }
    await mkdir(resolvedDir, { recursive: true });
    const files: string[] = [];

    for (const user of targets) {
      try {
        const data = await gatherReportData({
          actor: opts.actor,
          targetUserId: user.id,
          from: period.from,
          to: new Date(period.to.getTime() - 1), // gatherReportData treats `to` as inclusive
        });
        const pdf = await toPdf(data);
        const fileName = buildReportFileName({ userName: user.name, periodKey: period.periodKey });
        // 0o600: time sheets contain personal data (ArbZG), keep them
        // unreadable to other processes/users on the server.
        await writeFile(path.join(resolvedDir, fileName), pdf, { mode: 0o600 });
        generated += 1;
        files.push(fileName);
      } catch (e) {
        failed += 1;
        errorHints.push(`${user.name}: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    }

    const errorText = errorHints.length > 0 ? errorHints.join("; ") : null;
    const status = failed === 0 ? "SUCCESS" : generated > 0 ? "PARTIAL" : "ERROR";
    await db.reportAutomationRun.update({
      where: { id: run.id },
      data: {
        status,
        generated,
        failed,
        error: errorText?.slice(0, 2000) ?? null,
        finishedAt: new Date(),
      },
    });
    // Both manual and scheduled runs are audited; scheduled runs log
    // anonymously (the system actor has no User row, FK actorId must be null).
    await audit({
      actorId: opts.kind === "SCHEDULED" || opts.actor.id === "system" ? null : opts.actor.id,
      action:
        opts.kind === "SCHEDULED"
          ? "report_automation.scheduled_run"
          : "report_automation.manual_run",
      entity: "ReportAutomation",
      entityId: "singleton",
      payload: { periodKey: period.periodKey, generated, failed, kind: opts.kind },
    });
    return {
      status,
      periodKey: period.periodKey,
      generated,
      failed,
      error: errorText,
      files,
    };
  } catch (e) {
    await db.reportAutomationRun.update({
      where: { id: run.id },
      data: {
        status: "ERROR",
        generated,
        failed,
        error: e instanceof Error ? e.message.slice(0, 2000) : "Unknown error",
        finishedAt: new Date(),
      },
    });
    return {
      status: "ERROR",
      periodKey: period.periodKey,
      generated,
      failed,
      error: e instanceof Error ? e.message : "Unknown error",
      files: [],
    };
  }
}

function periodKeyForManual(periodKey: string): string {
  return `${periodKey}#manual-${Date.now()}-` + Math.random().toString(36).slice(2, 6);
}

async function pickTargetUsers(
  config: ReportAutomationConfig
): Promise<{ id: string; name: string }[]> {
  if (config.scope === "ALL") {
    return db.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }
  if (config.userIds.length === 0) return [];
  return db.user.findMany({
    where: { active: true, id: { in: config.userIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

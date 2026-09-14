import { cache } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { OrgSettings, User } from "@prisma/client";
import { startReportAutomationScheduler } from "@/server/report-scheduler";

// Report automation scheduler: started on the first authenticated request
// instead of an instrumentation hook. This keeps its `pg`/`fs` dependency
// chain strictly inside Node.js server bundles (never middleware/edge or
// client chunks) and survives redeploys via the (kind, periodKey)
// idempotency on ReportAutomationRun.
let schedulerStarter: Promise<void> | null = null;

function ensureReportScheduler(): void {
  if (!schedulerStarter) {
    schedulerStarter = startReportAutomationScheduler().then(
      () => {},
      (e) => {
        console.error("[report-automation] scheduler failed to start:", e);
        schedulerStarter = null;
      }
    );
  }
}

export type SessionUser = {
  id: string;
  role: "EMPLOYEE" | "ADMIN";
  name?: string | null;
  email?: string | null;
};

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.role) {
    throw new Response("Unauthorized", { status: 401 });
  }
  ensureReportScheduler();
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  };
}

export const getOrgSettings = cache(async (): Promise<OrgSettings> => {
  const settings = await db.orgSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    throw new Error("OrgSettings singleton missing — run prisma:seed");
  }
  return settings;
});

export async function getUserContext(userId: string): Promise<{
  user: User;
  timeZone: string;
  lockWindowDays: number;
}> {
  const [user, settings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    getOrgSettings(),
  ]);
  return {
    user,
    timeZone: user.timezone || "Europe/Berlin",
    lockWindowDays: settings.timeEntryLockWindowDays,
  };
}

export async function audit(opts: {
  actorId: string | null;
  targetId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: opts.actorId,
        targetId: opts.targetId ?? null,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId ?? null,
        payload: (opts.payload as never) ?? undefined,
      },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

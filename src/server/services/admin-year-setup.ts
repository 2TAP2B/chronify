import { db } from "@/lib/db";
import { audit, type SessionUser } from "@/server/context";
import { computeYearOvertime } from "@/server/services/overtime";

export class YearSetupError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
  }
}

function requireAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN") {
    throw new YearSetupError("Forbidden", "FORBIDDEN", 403);
  }
}

export async function runYearSetup(opts: {
  actor: SessionUser;
  year: number;
  carriedOverFromPrev?: boolean;
}): Promise<{
  year: number;
  usersProcessed: number;
  entitlementsCreated: number;
  balancesCreated: number;
}> {
  requireAdmin(opts.actor);
  const year = opts.year;
  const users = await db.user.findMany({
    where: { active: true },
    select: { id: true, timezone: true },
  });

  let entitlementsCreated = 0;
  let balancesCreated = 0;
  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });

  for (const u of users) {
    // VacationEntitlement: upsert with org default days; carry over from prev year if requested
    let carriedOverDays = 0;
    if (opts.carriedOverFromPrev) {
      const prev = await db.vacationEntitlement.findUnique({
        where: { userId_year: { userId: u.id, year: year - 1 } },
      });
      const prevConsumed = prev?.consumedDays ?? 0;
      const prevTotal = prev?.totalDays ?? settings.defaultVacationDays;
      const prevAvailable = Math.max(0, prevTotal + (prev?.carriedOverDays ?? 0) - prevConsumed);
      // Carryover cap: by law typically up to remaining days (no cap beyond what's left)
      carriedOverDays = prevAvailable;
    }
    const ent = await db.vacationEntitlement.upsert({
      where: { userId_year: { userId: u.id, year } },
      create: {
        userId: u.id,
        year,
        totalDays: settings.defaultVacationDays,
        carriedOverDays,
      },
      update: {
        totalDays: settings.defaultVacationDays,
        ...(opts.carriedOverFromPrev ? { carriedOverDays } : {}),
      },
    });
    if (ent) entitlementsCreated++;

    // OvertimeBalance: compute carriedOverMinutes from prev year's totalDeltaMs
    let carriedOverMinutes = 0;
    if (opts.carriedOverFromPrev) {
      const prevCompute = await computeYearOvertime({
        userId: u.id,
        year: year - 1,
        timeZone: u.timezone || "Europe/Berlin",
      });
      carriedOverMinutes = Math.round(prevCompute.computation.totalDeltaMs / 60_000);
      // Also persist previous year's computedMinutes
      await db.overtimeBalance.upsert({
        where: { userId_year: { userId: u.id, year: year - 1 } },
        create: {
          userId: u.id,
          year: year - 1,
          carriedOverMinutes: prevCompute.carriedOverMinutes,
          computedMinutes: carriedOverMinutes,
          lockedAt: new Date(),
        },
        update: {
          computedMinutes: carriedOverMinutes,
          lockedAt: new Date(),
        },
      });
    }
    const bal = await db.overtimeBalance.upsert({
      where: { userId_year: { userId: u.id, year } },
      create: {
        userId: u.id,
        year,
        carriedOverMinutes,
      },
      update: {
        ...(opts.carriedOverFromPrev ? { carriedOverMinutes } : {}),
      },
    });
    if (bal) balancesCreated++;
  }

  await audit({
    actorId: opts.actor.id,
    action: "year_setup.run",
    entity: "OrgSettings",
    payload: { year, carriedOver: opts.carriedOverFromPrev ?? false, users: users.length },
  });

  return {
    year,
    usersProcessed: users.length,
    entitlementsCreated,
    balancesCreated,
  };
}

export async function getYearSetupStatus(opts: { actor: SessionUser; year: number }) {
  requireAdmin(opts.actor);
  const [entitlements, balances] = await Promise.all([
    db.vacationEntitlement.count({ where: { year: opts.year } }),
    db.overtimeBalance.count({ where: { year: opts.year } }),
  ]);
  const userCount = await db.user.count({ where: { active: true } });
  return {
    year: opts.year,
    activeUsers: userCount,
    entitlements,
    balances,
    setupComplete: entitlements >= userCount && balances >= userCount,
  };
}

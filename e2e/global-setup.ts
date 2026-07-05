import { db } from "@/lib/db";

export default async function globalSetup() {
  const admin = await db.user.findFirst({ where: { email: "admin@puku.local" } });
  if (admin) {
    // Delete all vacation requests created by e2e tests (note starts with "E2E")
    await db.vacationRequest.deleteMany({
      where: { userId: admin.id, note: { startsWith: "E2E" } },
    });
    // Also delete any other vacation requests (PENDING or APPROVED) for the admin
    // that were created by prior test runs, then reset consumedDays
    await db.vacationRequest.deleteMany({ where: { userId: admin.id } });
    const year = new Date().getUTCFullYear();
    await db.vacationEntitlement.upsert({
      where: { userId_year: { userId: admin.id, year } },
      create: { userId: admin.id, year, totalDays: 30, consumedDays: 0 },
      update: { consumedDays: 0 },
    });
    // Delete time entries created by timer e2e tests (source=TIMER)
    await db.timeEntry.deleteMany({
      where: { userId: admin.id, source: "TIMER" },
    });
    // Delete the active timer session so the timer test starts clean
    await db.timerSession.deleteMany({ where: { userId: admin.id } });
  }
  // Delete any leftover e2e users
  await db.user.deleteMany({
    where: { email: { contains: "@e2e.test" } },
  });
}



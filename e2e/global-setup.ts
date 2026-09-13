import "@/lib/load-env";
import { db } from "@/lib/db";

export default async function globalSetup() {
  const admin = await db.user.findFirst({ where: { email: "admin@puku.local" } });
  if (admin) {
    // Delete any vacation requests (PENDING or APPROVED) left over from earlier
    // e2e runs for the admin, then reset consumedDays
    await db.vacationRequest.deleteMany({ where: { userId: admin.id } });
    const year = new Date().getUTCFullYear();
    await db.vacationEntitlement.upsert({
      where: { userId_year: { userId: admin.id, year } },
      create: { userId: admin.id, year, totalDays: 30, consumedDays: 0 },
      update: { consumedDays: 0 },
    });
    // Delete time entries created by e2e runs: timer entries (source=TIMER) and
    // the VACATION entries the approval test materialises (source=ADMIN)
    await db.timeEntry.deleteMany({
      where: {
        userId: admin.id,
        OR: [{ source: "TIMER" }, { type: "VACATION", source: "ADMIN" }],
      },
    });
    // Delete the active timer session so the timer test starts clean
    await db.timerSession.deleteMany({ where: { userId: admin.id } });
  }
  // Delete any leftover e2e users
  await db.user.deleteMany({
    where: { email: { contains: "@e2e.test" } },
  });
}

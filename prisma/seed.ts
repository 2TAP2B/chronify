import { PrismaClient, Role, BreakMode, FederalState } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database…");

  // OrgSettings singleton
  await prisma.orgSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      defaultFederalState: FederalState.DE_NW,
      overtimeCarryoverCutoffMonth: 4,
      overtimeCarryoverCutoffDay: 1,
      timeEntryLockWindowDays: 7,
      autoBreakDefault: BreakMode.AUTO,
      defaultVacationDays: 30,
    },
  });
  console.log("✓ OrgSettings");

  // Admin user
  const passwordHash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@puku.local" },
    update: {},
    create: {
      email: "admin@puku.local",
      passwordHash,
      name: "Administrator",
      firstName: "Admin",
      lastName: "istrator",
      role: Role.ADMIN,
      federalState: FederalState.DE_NW,
      locale: "de",
      breakMode: BreakMode.AUTO,
      hireDate: new Date("2026-01-01T00:00:00Z"),
    },
  });
  console.log("✓ Admin user (admin@puku.local / admin123)");

  // Default working model for admin (Mon-Fri 8h, weekends 0)
  const admin = await prisma.user.findUnique({
    where: { email: "admin@puku.local" },
  });
  if (admin) {
    await prisma.workingModel.upsert({
      where: {
        id: "admin-default-model",
      },
      update: {},
      create: {
        id: "admin-default-model",
        userId: admin.id,
        validFrom: new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`),
        mondayMinutes: 480,
        tuesdayMinutes: 480,
        wednesdayMinutes: 480,
        thursdayMinutes: 480,
        fridayMinutes: 480,
        saturdayMinutes: 0,
        sundayMinutes: 0,
        weeklyTargetMinutes: 2400,
      },
    });
    console.log("✓ Admin working model (40h/week)");
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

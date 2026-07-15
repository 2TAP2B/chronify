import { db } from "../src/lib/db";
import { getOrgSettings } from "../src/server/context";
import { runRetentionCleanup } from "../src/server/services/gdpr-cleanup";
import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(`=== Retention Cleanup ${dryRun ? "(DRY RUN)" : ""} ===`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");

  const settings = await getOrgSettings();
  console.log(`Retention config:`);
  console.log(`  retentionYears: ${settings.retentionYears}`);
  console.log(`  sickNoteRetentionMonths: ${settings.sickNoteRetentionMonths}`);
  console.log(`  auditLogRetentionMonths: ${settings.auditLogRetentionMonths}`);
  console.log("");

  // Use a system actor for cron-triggered cleanup
  const systemActor = { id: "system", role: "ADMIN" as const };

  const result = await runRetentionCleanup(systemActor, { dryRun });

  console.log(`Results ${dryRun ? "(would delete)" : "(deleted)"}:`);
  console.log(`  Time entries:       ${result.timeEntries}`);
  console.log(`  Vacation requests:  ${result.vacationRequests}`);
  console.log(`  Sick notes:         ${result.sickNotes}`);
  console.log(`  Audit logs:         ${result.auditLogs}`);
  console.log(`  Notifications:      ${result.notifications}`);
  console.log(`  Anonymized users:   ${result.inactiveUsers}`);
  console.log("");
  console.log("Done.");

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
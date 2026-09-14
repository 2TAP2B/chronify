import "@/lib/load-env";
import { db } from "../src/lib/db";
import { runReportAutomation } from "../src/server/services/report-automation";

/**
 * Manual one-shot report automation run (for verification / catch-up).
 * Usage: REPORTS_EXPORT_DIR=/data/reports npm run reports:run
 */
async function main() {
  console.log(`=== Report automation (manual run) ===`);
  const actor = { id: "system", role: "ADMIN" } as const;
  const result = await runReportAutomation({ actor, kind: "MANUAL" });
  console.log(`Period:   ${result.periodKey}`);
  console.log(`Status:   ${result.status}`);
  console.log(`PDFs:     ${result.generated} generated, ${result.failed} failed`);
  if (result.error) console.log(`Errors:   ${result.error}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

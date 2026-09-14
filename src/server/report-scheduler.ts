import { db } from "@/lib/db";
import { toCalendarDate } from "@/lib/datetime";
import {
  computePeriod,
  isScheduledDue,
  type ReportAutomationFrequencyValue,
} from "@/lib/reports/automation-period";
import { runReportAutomation, toConfig } from "@/server/services/report-automation";

const CHECK_INTERVAL_MS = 60_000;
const SYSTEM_ACTOR = { id: "system", role: "ADMIN" as const, name: "System" };

let started = false;
let busy = false;

export function startReportAutomationScheduler(): Promise<void> {
  if (started) return Promise.resolve();
  started = true;
  if (process.env.REPORT_AUTOMATION_SCHEDULER === "off") return Promise.resolve();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref();
  setTimeout(tick, 5_000).unref();
  return Promise.resolve();
}

async function tick(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    await runOnce(new Date());
  } catch (e) {
    console.error("[report-automation] tick failed:", e);
  } finally {
    busy = false;
  }
}

/** One scheduler pass; exported for tests. */
export async function runOnce(now: Date): Promise<void> {
  const row = await db.reportAutomation.findUnique({ where: { id: "singleton" } });
  if (!row || !row.enabled) return;

  const config = toConfig(row);

  if (!isScheduledDue(config, now)) return;

  // Same Berlin-calendar ref as the run itself (see runReportAutomation).
  const period = computePeriod(
    config.frequency as ReportAutomationFrequencyValue,
    toCalendarDate(now, "Europe/Berlin")
  );
  const existing = await db.reportAutomationRun.findUnique({
    where: { kind_periodKey: { kind: "SCHEDULED", periodKey: period.periodKey } },
  });
  if (existing) return;

  console.log(`[report-automation] scheduled run for ${period.periodKey} starting`);
  await runReportAutomation({
    actor: SYSTEM_ACTOR,
    kind: "SCHEDULED",
    now,
    configOverride: config,
  });
}

import { db } from "@/lib/db";
import { toCalendarDate } from "@/lib/datetime";
import { syncHolidaysForState } from "@/server/services/holidays";

/**
 * Year change housekeeping. Carryover of vacation days and overtime needs no
 * job — both are computed live from the previous year. What must exist ahead
 * of time are the public holidays: without them holidays count as working
 * days (overtime minus, vacation charged). This syncs the current year and,
 * from December on, the next year for every federal state in use.
 */
const CHECK_INTERVAL_MS = 6 * 60 * 60_000;

let started = false;
let busy = false;

export function startYearRolloverScheduler(): void {
  if (started) return;
  started = true;
  if (process.env.YEAR_ROLLOVER_SCHEDULER === "off") return;
  setInterval(tick, CHECK_INTERVAL_MS).unref();
  setTimeout(tick, 10_000).unref();
}

async function tick(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    await ensureHolidays(new Date());
  } catch (e) {
    console.error("[year-rollover] tick failed:", e);
  } finally {
    busy = false;
  }
}

/** Syncs holidays for each year/state that has none yet. Exported for scripts. */
export async function ensureHolidays(now: Date): Promise<void> {
  const today = toCalendarDate(now, "Europe/Berlin");
  const year = today.getUTCFullYear();
  const years = today.getUTCMonth() === 11 ? [year, year + 1] : [year];

  const [users, settings] = await Promise.all([
    db.user.findMany({
      where: { active: true },
      select: { federalState: true },
      distinct: ["federalState"],
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);
  const states = [...new Set([settings.defaultFederalState, ...users.map((u) => u.federalState)])];
  for (const y of years) {
    for (const state of states) {
      const existing = await db.publicHoliday.count({
        where: {
          federalState: state,
          date: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) },
        },
      });
      // Only fill gaps: re-syncing an existing year would overwrite manually
      // edited holidays (the upsert resets name/source).
      if (existing > 0) continue;
      try {
        const r = await syncHolidaysForState(y, state);
        console.log(`[year-rollover] holidays ${state} ${y}: ${r.upserted} synced`);
      } catch (e) {
        console.error(`[year-rollover] holiday sync ${state} ${y} failed:`, e);
      }
    }
  }
}

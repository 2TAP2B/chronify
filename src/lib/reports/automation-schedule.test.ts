import { describe, it, expect } from "vitest";
import { isScheduledDue, computePeriod } from "@/lib/reports/automation-period";

// All `now` instants below are actual instants; the function evaluates the
// Europe/Berlin calendar so the same instant yields the same result on any
// host time zone (tests must be TZ independent - see AGENTS.md).
function berin(y: number, m: number, d: number, h: number): Date {
  // Europe/Berlin: UTC+2 (CEST, roughly Apr–Oct) or UTC+1 (CET). Fixtures lie
  // in the interior of the two seasons, never on a switch weekend.
  const winter = m <= 2 || m >= 11;
  return new Date(Date.UTC(y, m - 1, d, h) - (winter ? 1 : 2) * 3_600_000);
}

const weekly = (weeklyDay: number, runHour: number) =>
  ({ frequency: "WEEKLY", weeklyDay, runHour, monthlyDay: 1 }) as const;
const monthly = (monthlyDay: number, runHour: number) =>
  ({ frequency: "MONTHLY", monthlyDay, runHour, weeklyDay: 1 }) as const;

describe("isScheduledDue (weekly)", () => {
  it("is due on the configured weekday after the scheduled hour", () => {
    expect(isScheduledDue(weekly(1, 6), berin(2026, 9, 14, 7))).toBe(true); // Mon 07:00, hour 06
  });

  it("is not due before the scheduled hour on the same day", () => {
    expect(isScheduledDue(weekly(1, 6), berin(2026, 9, 14, 5))).toBe(false); // Mon 05:00
  });

  it("catches up later in the same week (downtime recovery)", () => {
    expect(isScheduledDue(weekly(1, 6), berin(2026, 9, 16, 22))).toBe(true); // Wed
  });

  it("never fires before the scheduled weekday", () => {
    expect(isScheduledDue(weekly(5, 6), berin(2026, 9, 14, 23))).toBe(false); // Mon, schedule Fri
  });
});

describe("isScheduledDue (monthly)", () => {
  it("is due on the configured day after the scheduled hour", () => {
    expect(isScheduledDue(monthly(5, 6), berin(2026, 9, 5, 7))).toBe(true);
  });

  it("catches up later in the same month", () => {
    expect(isScheduledDue(monthly(5, 6), berin(2026, 9, 20, 10))).toBe(true);
  });

  it("never fires earlier in the month", () => {
    expect(isScheduledDue(monthly(20, 6), berin(2026, 9, 19, 8))).toBe(false);
  });

  it("clamps the day to the month length (day 31 → Feb 28)", () => {
    expect(isScheduledDue(monthly(31, 0), berin(2026, 2, 28, 1))).toBe(true); // Feb 28 01:00
    expect(isScheduledDue(monthly(31, 0), berin(2026, 2, 27, 23))).toBe(false);
  });

  it("fires from 00:00 of the month's first day for monthlyDay=1", () => {
    expect(isScheduledDue(monthly(1, 0), berin(2026, 9, 1, 0))).toBe(true);
  });
});

describe("period selection aligns with due dates", () => {
  it("a Monday run always covers the finished week before it", () => {
    // Mon 14.09. 07:00 Berlin → covers 07.–13.09 (W37)
    const now = berin(2026, 9, 14, 7);
    expect(isScheduledDue(weekly(1, 6), now)).toBe(true);
    const period = computePeriod("WEEKLY", now);
    expect(period.periodKey).toBe("2026-W37");
  });

  it("a monthly first-of-month run covers the previous month", () => {
    const now = berin(2026, 9, 1, 3);
    expect(isScheduledDue(monthly(1, 0), now)).toBe(true);
    expect(computePeriod("MONTHLY", now).periodKey).toBe("2026-08");
  });
});

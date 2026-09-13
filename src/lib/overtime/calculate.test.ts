import { describe, expect, it } from "vitest";
import {
  targetMinutesForDate,
  computeDailyDelta,
  summarizeDay,
  sumDeltaMs,
  msToSignedHours,
  msToSignedMinutes,
  formatSignedDuration,
  carryoverCutoffDate,
  isAfterCarryoverCutoff,
  computeOvertimeForYear,
  type WorkingModelMinutes,
} from "@/lib/overtime/calculate";

const fullWeek: WorkingModelMinutes = {
  mondayMinutes: 480,
  tuesdayMinutes: 480,
  wednesdayMinutes: 480,
  thursdayMinutes: 480,
  fridayMinutes: 480,
  saturdayMinutes: 0,
  sundayMinutes: 0,
  weeklyTargetMinutes: 2400,
};

const H = 60 * 60_000;
const M = 60_000;

describe("targetMinutesForDate", () => {
  it("returns per-weekday target", () => {
    // 2026-07-06 is a Monday (UTC)
    const monday = new Date("2026-07-06T00:00:00Z");
    expect(targetMinutesForDate(monday, fullWeek)).toBe(480);
    const saturday = new Date("2026-07-11T00:00:00Z");
    expect(targetMinutesForDate(saturday, fullWeek)).toBe(0);
  });
});

describe("computeDailyDelta", () => {
  it("positive when worked exceeds target", () => {
    // 9h worked, 8h target -> +1h
    const delta = computeDailyDelta(9 * H, 480);
    expect(msToSignedMinutes(delta)).toBe(60);
  });

  it("negative when under target", () => {
    const delta = computeDailyDelta(7 * H, 480);
    expect(msToSignedMinutes(delta)).toBe(-60);
  });

  it("zero when exactly target", () => {
    expect(computeDailyDelta(8 * H, 480)).toBe(0);
  });

  it("non-working day: worked hours are all plus", () => {
    const delta = computeDailyDelta(2 * H, 0);
    expect(msToSignedMinutes(delta)).toBe(120);
  });
});

describe("summarizeDay", () => {
  it("aggregates worked/break/target/delta", () => {
    const monday = new Date("2026-07-06T00:00:00Z");
    const s = summarizeDay({ date: monday, workedMs: 9 * H, breakMinutes: 30, model: fullWeek });
    expect(s.targetMinutes).toBe(480);
    expect(msToSignedMinutes(s.deltaMs)).toBe(60);
    expect(s.breakMinutes).toBe(30);
  });

  it("missed day (workedMs=0) produces negative delta equal to -target", () => {
    const monday = new Date("2026-07-06T00:00:00Z");
    const s = summarizeDay({ date: monday, workedMs: 0, breakMinutes: 0, model: fullWeek });
    expect(s.targetMinutes).toBe(480);
    expect(msToSignedMinutes(s.deltaMs)).toBe(-480);
  });

  it("weekend (target=0) with no work produces zero delta", () => {
    const saturday = new Date("2026-07-11T00:00:00Z");
    const s = summarizeDay({ date: saturday, workedMs: 0, breakMinutes: 0, model: fullWeek });
    expect(s.targetMinutes).toBe(0);
    expect(msToSignedMinutes(s.deltaMs)).toBe(0);
  });

  it("exactly meeting target produces zero delta", () => {
    const monday = new Date("2026-07-06T00:00:00Z");
    const s = summarizeDay({ date: monday, workedMs: 8 * H, breakMinutes: 0, model: fullWeek });
    expect(msToSignedMinutes(s.deltaMs)).toBe(0);
  });
});

describe("sumDeltaMs", () => {
  it("sums deltas across days", () => {
    const d1 = {
      date: new Date(),
      workedMs: 9 * H,
      breakMinutes: 30,
      targetMinutes: 480,
      deltaMs: 60 * M,
    };
    const d2 = {
      date: new Date(),
      workedMs: 7 * H,
      breakMinutes: 0,
      targetMinutes: 480,
      deltaMs: -60 * M,
    };
    expect(sumDeltaMs([d1, d2])).toBe(0);
  });
});

describe("formatSignedDuration / msToSignedHours", () => {
  it("formats +HH:MM", () => {
    expect(formatSignedDuration(90 * M)).toBe("+01:30");
    expect(formatSignedDuration(0)).toBe("+00:00");
  });

  it("formats -HH:MM", () => {
    expect(formatSignedDuration(-90 * M)).toBe("-01:30");
    expect(formatSignedDuration(-60 * M)).toBe("-01:00");
  });

  it("msToSignedHours rounds to 2 decimals", () => {
    expect(msToSignedHours(90 * M)).toBe(1.5);
    expect(msToSignedHours(-90 * M)).toBe(-1.5);
    expect(msToSignedHours(0)).toBe(0);
  });
});

describe("carryoverCutoff", () => {
  it("builds cutoff date (month is 1-based)", () => {
    expect(carryoverCutoffDate(2026, 4, 1)).toEqual(new Date("2026-04-01T00:00:00Z"));
    expect(carryoverCutoffDate(2026, 1, 1)).toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("isAfterCarryoverCutoff", () => {
    const cutoff = carryoverCutoffDate(2026, 4, 1);
    expect(isAfterCarryoverCutoff(new Date("2026-04-01T00:00:00Z"), cutoff)).toBe(true);
    expect(isAfterCarryoverCutoff(new Date("2026-03-31T23:59:59Z"), cutoff)).toBe(false);
  });
});

describe("computeOvertimeForYear", () => {
  const makeDay = (dateStr: string, workedH: number, target: number) => {
    const date = new Date(dateStr);
    const workedMs = workedH * H;
    return summarizeDay({ date, workedMs, breakMinutes: 0, model: { ...fullWeek } })
      ? {
          date,
          workedMs,
          breakMinutes: 0,
          targetMinutes: target,
          deltaMs: computeDailyDelta(workedMs, target),
        }
      : null;
  };

  it("sums monthly and yearly deltas", () => {
    const days = [
      makeDay("2026-01-06T00:00:00Z", 9, 480)!, // +60
      makeDay("2026-01-07T00:00:00Z", 7, 480)!, // -60
      makeDay("2026-02-09T00:00:00Z", 10, 480)!, // +120
    ];
    const r = computeOvertimeForYear({ year: 2026, days, carriedOverMinutes: 0 });
    expect(msToSignedMinutes(r.totalDeltaMs)).toBe(120);
    expect(msToSignedMinutes(r.byMonth[0].deltaMs)).toBe(0); // Jan: +60-60
    expect(msToSignedMinutes(r.byMonth[1].deltaMs)).toBe(120); // Feb
    expect(msToSignedMinutes(r.balanceMs)).toBe(120);
  });

  it("adds carryover to balance", () => {
    const days = [makeDay("2026-03-09T00:00:00Z", 9, 480)!];
    const r = computeOvertimeForYear({ year: 2026, days, carriedOverMinutes: 240 });
    expect(r.carriedOverMinutes).toBe(240);
    expect(msToSignedMinutes(r.totalDeltaMs)).toBe(60);
    expect(msToSignedMinutes(r.balanceMs)).toBe(300); // 240 + 60
  });

  it("handles negative carryover", () => {
    const r = computeOvertimeForYear({ year: 2026, days: [], carriedOverMinutes: -120 });
    expect(msToSignedMinutes(r.balanceMs)).toBe(-120);
    expect(r.byMonth).toHaveLength(12);
  });

  it("subtracts consumed overtime from balance", () => {
    const days = [makeDay("2026-03-09T00:00:00Z", 9, 480)!]; // +60
    const r = computeOvertimeForYear({
      year: 2026,
      days,
      carriedOverMinutes: 240,
      consumedOvertimeMinutes: 120,
    });
    expect(r.consumedOvertimeMinutes).toBe(120);
    expect(msToSignedMinutes(r.balanceMs)).toBe(180); // 240 + 60 - 120
  });

  it("defaults consumedOvertimeMinutes to 0", () => {
    const r = computeOvertimeForYear({ year: 2026, days: [], carriedOverMinutes: 0 });
    expect(r.consumedOvertimeMinutes).toBe(0);
  });
});

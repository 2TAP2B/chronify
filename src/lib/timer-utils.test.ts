import { describe, expect, it } from "vitest";
import {
  computeElapsedMs,
  computeBreakMs,
  isOnBreak,
  msToMinutes,
  formatDuration,
  formatDurationShort,
  isEntryLocked,
  type TimerState,
} from "@/lib/timer-utils";

function state(overrides: Partial<TimerState> = {}): TimerState {
  return {
    startedAt: 0,
    lastTickAt: 0,
    breakStartedAt: null,
    accumulatedBreakMs: 0,
    ...overrides,
  };
}

describe("computeElapsedMs", () => {
  it("returns worked time minus breaks", () => {
    const s = state({ startedAt: 0, accumulatedBreakMs: 30 * 60_000 });
    // 4h elapsed, 30min break -> 3h30m worked
    expect(computeElapsedMs(s, 4 * 3_600_000)).toBe(4 * 3_600_000 - 30 * 60_000);
  });

  it("subtracts running break when on break", () => {
    const s = state({
      startedAt: 0,
      breakStartedAt: 3 * 3_600_000,
      accumulatedBreakMs: 0,
    });
    // At 4h mark, 1h on break -> 3h worked
    expect(computeElapsedMs(s, 4 * 3_600_000)).toBe(3 * 3_600_000);
  });

  it("accumulates completed break plus running break", () => {
    const s = state({
      startedAt: 0,
      breakStartedAt: 5 * 3_600_000,
      accumulatedBreakMs: 30 * 60_000,
    });
    // At 6h mark: 30min completed + 1h running = 1h30 break; worked = 4h30
    expect(computeBreakMs(s, 6 * 3_600_000)).toBe(30 * 60_000 + 1 * 3_600_000);
    expect(computeElapsedMs(s, 6 * 3_600_000)).toBe(6 * 3_600_000 - 30 * 60_000 - 1 * 3_600_000);
  });

  it("never returns negative", () => {
    const s = state({ startedAt: 10_000, accumulatedBreakMs: 10_000_000 });
    expect(computeElapsedMs(s, 0)).toBe(0);
  });
});

describe("isOnBreak", () => {
  it("true when breakStartedAt set", () => {
    expect(isOnBreak(state({ breakStartedAt: 123 }))).toBe(true);
    expect(isOnBreak(state({ breakStartedAt: null }))).toBe(false);
  });
});

describe("msToMinutes", () => {
  it("rounds to nearest minute", () => {
    expect(msToMinutes(90_000)).toBe(2); // 1.5min -> 2
    expect(msToMinutes(60_000)).toBe(1);
    expect(msToMinutes(30_000)).toBe(1); // 0.5 -> 1
    expect(msToMinutes(29_000)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats H:MM:SS", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(3_600_000)).toBe("01:00:00");
    expect(formatDuration(3_661_000)).toBe("01:01:01");
  });
});

describe("formatDurationShort", () => {
  it("formats H:MM (floors minutes)", () => {
    expect(formatDurationShort(0)).toBe("00:00");
    expect(formatDurationShort(90_000)).toBe("00:01");
    expect(formatDurationShort(3_600_000)).toBe("01:00");
    expect(formatDurationShort(3_960_000)).toBe("01:06");
  });
});

describe("isEntryLocked", () => {
  it("locks entries older than window", () => {
    const now = new Date("2026-07-05T12:00:00Z");
    const old = new Date("2026-06-20T12:00:00Z"); // 15 days ago
    expect(isEntryLocked(old, 7, now)).toBe(true);
  });

  it("does not lock entries within window", () => {
    const now = new Date("2026-07-05T12:00:00Z");
    const recent = new Date("2026-07-01T12:00:00Z"); // 4 days ago
    expect(isEntryLocked(recent, 7, now)).toBe(false);
  });

  it("boundary: exactly at window days is not locked (uses >)", () => {
    const now = new Date("2026-07-05T12:00:00Z");
    const at7 = new Date("2026-06-28T11:59:00Z"); // just over 7 days
    expect(isEntryLocked(at7, 7, now)).toBe(true);
    const justUnder = new Date("2026-06-28T12:00:01Z"); // just under 7 days
    expect(isEntryLocked(justUnder, 7, now)).toBe(false);
  });

  it("window 0 means everything older than 0 days is locked", () => {
    const now = new Date("2026-07-05T12:00:00Z");
    const earlier = new Date("2026-07-05T06:00:00Z");
    expect(isEntryLocked(earlier, 0, now)).toBe(true);
    expect(isEntryLocked(now, 0, now)).toBe(false);
  });
});

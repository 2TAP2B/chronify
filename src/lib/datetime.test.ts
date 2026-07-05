import { describe, it, expect } from "vitest";
import {
  toCalendarDate,
  startOfWeekUtc,
  addDaysUtc,
  addMinutes,
  isSameCalendarDay,
  startOfDayUtc,
  WEEKDAYS,
  utcToZonedTime,
} from "./datetime";

const BERLIN = "Europe/Berlin";

describe("toCalendarDate", () => {
  it("returns midnight UTC for the calendar date in the given zone", () => {
    // 2026-03-15T13:37Z is 14:37 in Berlin → same calendar date
    const d = toCalendarDate(new Date("2026-03-15T13:37:00Z"), BERLIN);
    expect(d.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("crosses day boundary when instant is just past midnight UTC but still previous day in zone", () => {
    // 2026-03-15T22:30Z is 23:30 in Berlin (still Mar 15)
    // 2026-03-15T23:30Z is 00:30 next day in Berlin (Mar 16)
    expect(
      toCalendarDate(new Date("2026-03-15T22:30:00Z"), BERLIN).toISOString()
    ).toBe("2026-03-15T00:00:00.000Z");
    expect(
      toCalendarDate(new Date("2026-03-15T23:30:00Z"), BERLIN).toISOString()
    ).toBe("2026-03-16T00:00:00.000Z");
  });
});

describe("startOfDayUtc", () => {
  it("is alias for toCalendarDate", () => {
    const t = new Date("2026-07-05T10:11:12Z");
    expect(startOfDayUtc(t, BERLIN)).toEqual(toCalendarDate(t, BERLIN));
  });
});

describe("startOfWeekUtc", () => {
  it("returns Monday of the same week (Mon-Sun)", () => {
    // 2026-07-05 is a Sunday → Monday is 2026-06-29
    const monday = startOfWeekUtc(new Date("2026-07-05T10:00:00Z"), BERLIN);
    expect(monday.toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });

  it("handles Wednesday midweek", () => {
    // 2026-07-01 is a Wednesday → Monday is 2026-06-29
    const monday = startOfWeekUtc(new Date("2026-07-01T08:00:00Z"), BERLIN);
    expect(monday.toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });

  it("handles Monday itself", () => {
    const monday = startOfWeekUtc(new Date("2026-06-29T05:00:00Z"), BERLIN);
    expect(monday.toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });
});

describe("addDaysUtc", () => {
  it("adds N days in UTC", () => {
    expect(
      addDaysUtc(new Date("2026-01-01T00:00:00Z"), 5).toISOString()
    ).toBe("2026-01-06T00:00:00.000Z");
  });

  it("handles negative deltas", () => {
    expect(
      addDaysUtc(new Date("2026-01-10T00:00:00Z"), -3).toISOString()
    ).toBe("2026-01-07T00:00:00.000Z");
  });

  it("does not mutate input", () => {
    const input = new Date("2026-01-01T00:00:00Z");
    addDaysUtc(input, 5);
    expect(input.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("addMinutes", () => {
  it("adds minutes to a Date", () => {
    expect(
      addMinutes(new Date("2026-01-01T10:00:00Z"), 90).toISOString()
    ).toBe("2026-01-01T11:30:00.000Z");
  });
});

describe("isSameCalendarDay", () => {
  it("true when same calendar date in zone", () => {
    expect(
      isSameCalendarDay(
        new Date("2026-03-15T05:00:00Z"),
        new Date("2026-03-15T22:00:00Z"),
        BERLIN
      )
    ).toBe(true);
  });

  it("false across day boundary in zone", () => {
    expect(
      isSameCalendarDay(
        new Date("2026-03-15T22:30:00Z"),
        new Date("2026-03-15T23:30:00Z"),
        BERLIN
      )
    ).toBe(false);
  });
});

describe("utcToZonedTime", () => {
  it("returns a Date whose UTC fields match wall-clock in Berlin (UTC+1 winter)", () => {
    // 2026-01-15T12:00:00Z → 13:00 Berlin (CET, UTC+1)
    const zoned = utcToZonedTime(new Date("2026-01-15T12:00:00Z"), BERLIN);
    expect(zoned.getUTCHours()).toBe(13);
    expect(zoned.getUTCMinutes()).toBe(0);
    expect(zoned.getUTCDate()).toBe(15);
  });

  it("handles DST (CEST, UTC+2) in summer", () => {
    // 2026-07-15T12:00:00Z → 14:00 Berlin (CEST)
    const zoned = utcToZonedTime(new Date("2026-07-15T12:00:00Z"), BERLIN);
    expect(zoned.getUTCHours()).toBe(14);
  });
});

describe("WEEKDAYS", () => {
  it("is Monday-first", () => {
    expect(WEEKDAYS[0]).toBe("mon");
    expect(WEEKDAYS[6]).toBe("sun");
    expect(WEEKDAYS).toHaveLength(7);
  });
});

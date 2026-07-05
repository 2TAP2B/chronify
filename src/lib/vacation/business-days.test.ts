import { describe, expect, it } from "vitest";
import {
  makeHolidayResolver,
  isWeekend,
  isBusinessDay,
  businessDaysInRange,
  overlapsExisting,
} from "@/lib/vacation/business-days";
import { shouldApplyForState, federalStateToNagerCode } from "@/lib/holidays/nager";
import type { PublicHoliday, FederalState } from "@prisma/client";

function mkHoliday(
  dateStr: string,
  state: FederalState,
  opts: Partial<PublicHoliday> = {}
): PublicHoliday {
  return {
    id: "x",
    date: new Date(`${dateStr}T00:00:00Z`),
    name: opts.name ?? "Test Holiday",
    federalState: state,
    type: opts.type ?? "Public",
    source: opts.source ?? "NAGER",
    counties: opts.counties ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const NW: FederalState = "DE_NW";
const BY: FederalState = "DE_BY";

describe("federalStateToNagerCode", () => {
  it("maps all states to ISO codes", () => {
    expect(federalStateToNagerCode("DE_NW")).toBe("NW");
    expect(federalStateToNagerCode("DE_BY")).toBe("BY");
    expect(federalStateToNagerCode("DE_BW")).toBe("BW");
  });
});

describe("shouldApplyForState", () => {
  it("global holiday applies to all states when state matches", () => {
    const h = mkHoliday("2026-01-01", NW, { counties: [] });
    expect(shouldApplyForState(h, NW)).toBe(true);
  });

  it("global holiday does NOT apply to a different federal state", () => {
    const h = mkHoliday("2026-01-01", NW, { counties: [] });
    expect(shouldApplyForState(h, BY)).toBe(false);
  });

  it("county-level holiday applies only to listed county in matching state", () => {
    const h = mkHoliday("2026-01-06", NW, { counties: ["DE-NW"] });
    expect(shouldApplyForState(h, NW)).toBe(true);
    expect(shouldApplyForState(h, BY)).toBe(false);
  });

  it("manual entries always win and apply to their declared state", () => {
    const h = mkHoliday("2026-03-01", NW, { source: "MANUAL", counties: [] });
    expect(shouldApplyForState(h, NW)).toBe(true);
    expect(shouldApplyForState(h, BY)).toBe(false);
  });
});

describe("makeHolidayResolver", () => {
  it("resolves a holiday by date+state", () => {
    const holidays = [mkHoliday("2026-01-01", NW, { name: "Neujahr" })];
    const r = makeHolidayResolver(holidays);
    expect(r(new Date("2026-01-01T00:00:00Z"), NW)?.name).toBe("Neujahr");
  });

  it("returns null when no holiday", () => {
    const holidays = [mkHoliday("2026-01-01", NW)];
    const r = makeHolidayResolver(holidays);
    expect(r(new Date("2026-01-02T00:00:00Z"), NW)).toBeNull();
    expect(r(new Date("2026-01-01T00:00:00Z"), BY)).toBeNull();
  });

  it("manual override beats NAGER for same date+state", () => {
    const nager = mkHoliday("2026-05-01", NW, { source: "NAGER", name: "Tag der Arbeit" });
    const manual = mkHoliday("2026-05-01", NW, { source: "MANUAL", name: "Betriebsfeier" });
    const r = makeHolidayResolver([nager, manual]);
    const resolved = r(new Date("2026-05-01T00:00:00Z"), NW);
    expect(resolved?.name).toBe("Betriebsfeier");
  });

  it("county-level wins over global for same date+state", () => {
    const global = mkHoliday("2026-11-01", NW, { counties: [], name: "Allerheiligen (global)" });
    const county = mkHoliday("2026-11-01", NW, { counties: ["DE-NW"], name: "Allerheiligen" });
    const r = makeHolidayResolver([global, county]);
    const resolved = r(new Date("2026-11-01T00:00:00Z"), NW);
    expect(resolved?.name).toBe("Allerheiligen");
  });
});

describe("isWeekend", () => {
  it("Saturday and Sunday are weekend", () => {
    expect(isWeekend(new Date("2026-07-04T00:00:00Z"))).toBe(true); // Sat
    expect(isWeekend(new Date("2026-07-05T00:00:00Z"))).toBe(true); // Sun
    expect(isWeekend(new Date("2026-07-06T00:00:00Z"))).toBe(false); // Mon
  });
});

describe("isBusinessDay", () => {
  it("weekday without holiday is business day", () => {
    const r = makeHolidayResolver([]);
    expect(isBusinessDay(new Date("2026-07-06T00:00:00Z"), NW, r)).toBe(true); // Mon
  });

  it("weekend is not business day", () => {
    const r = makeHolidayResolver([]);
    expect(isBusinessDay(new Date("2026-07-04T00:00:00Z"), NW, r)).toBe(false); // Sat
  });

  it("weekday with holiday is not business day", () => {
    const holidays = [mkHoliday("2026-07-06", NW)];
    const r = makeHolidayResolver(holidays);
    expect(isBusinessDay(new Date("2026-07-06T00:00:00Z"), NW, r)).toBe(false);
  });
});

describe("businessDaysInRange", () => {
  it("counts business days excluding weekends and holidays", () => {
    // Mon 2026-07-06 to Fri 2026-07-10 → 5 business days
    const holidays = [mkHoliday("2026-07-08", NW)]; // Wed holiday
    const r = makeHolidayResolver(holidays);
    const result = businessDaysInRange(
      new Date("2026-07-06T00:00:00Z"),
      new Date("2026-07-10T00:00:00Z"),
      NW,
      r
    );
    expect(result.businessDays).toHaveLength(4);
    expect(result.holidayCount).toBe(1);
    expect(result.weekendCount).toBe(0);
    expect(result.totalDays).toBe(5);
  });

  it("full week including weekend → 5 business days, 2 weekend", () => {
    const r = makeHolidayResolver([]);
    const result = businessDaysInRange(
      new Date("2026-07-06T00:00:00Z"), // Mon
      new Date("2026-07-12T00:00:00Z"), // Sun
      NW,
      r
    );
    expect(result.businessDays).toHaveLength(5);
    expect(result.weekendCount).toBe(2);
  });

  it("single day (holiday) returns 0 business days", () => {
    const holidays = [mkHoliday("2026-07-06", NW)];
    const r = makeHolidayResolver(holidays);
    const result = businessDaysInRange(
      new Date("2026-07-06T00:00:00Z"),
      new Date("2026-07-06T00:00:00Z"),
      NW,
      r
    );
    expect(result.businessDays).toHaveLength(0);
    expect(result.holidayCount).toBe(1);
  });

  it("inverted range returns empty", () => {
    const r = makeHolidayResolver([]);
    const result = businessDaysInRange(
      new Date("2026-07-10T00:00:00Z"),
      new Date("2026-07-06T00:00:00Z"),
      NW,
      r
    );
    expect(result.businessDays).toHaveLength(0);
    expect(result.totalDays).toBe(0);
  });
});

describe("overlapsExisting", () => {
  it("detects overlap", () => {
    const existing = [{ from: new Date("2026-07-06"), to: new Date("2026-07-10"), status: "APPROVED" }];
    expect(overlapsExisting(new Date("2026-07-08"), new Date("2026-07-12"), existing)).toBe(true);
    expect(overlapsExisting(new Date("2026-07-04"), new Date("2026-07-06"), existing)).toBe(true);
  });

  it("no overlap when ranges touch but don't intersect", () => {
    const existing = [{ from: new Date("2026-07-06"), to: new Date("2026-07-10"), status: "APPROVED" }];
    expect(overlapsExisting(new Date("2026-07-11"), new Date("2026-07-13"), existing)).toBe(false);
  });

  it("ignores rejected/cancelled requests", () => {
    const existing = [{ from: new Date("2026-07-06"), to: new Date("2026-07-10"), status: "REJECTED" }];
    expect(overlapsExisting(new Date("2026-07-08"), new Date("2026-07-12"), existing)).toBe(false);
  });
});

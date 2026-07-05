import { describe, expect, it } from "vitest";
import { businessDaysInRange, makeHolidayResolver, overlapsExisting } from "@/lib/vacation/business-days";
import type { PublicHoliday, FederalState } from "@prisma/client";

const NW: FederalState = "DE_NW";

function mkHoliday(dateStr: string, state: FederalState = NW): PublicHoliday {
  return {
    id: "x",
    date: new Date(`${dateStr}T00:00:00Z`),
    name: "Holiday",
    federalState: state,
    type: "Public",
    source: "NAGER",
    counties: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("sick-day business calc", () => {
  it("single sick day returns 1", () => {
    const r = makeHolidayResolver([]);
    const result = businessDaysInRange(
      new Date("2026-07-06T00:00:00Z"), // Mon
      new Date("2026-07-06T00:00:00Z"),
      NW,
      r
    );
    expect(result.businessDays).toHaveLength(1);
  });

  it("one-week sickness (Mon-Fri) = 5 days", () => {
    const r = makeHolidayResolver([]);
    const result = businessDaysInRange(
      new Date("2026-07-06T00:00:00Z"), // Mon
      new Date("2026-07-10T00:00:00Z"), // Fri
      NW,
      r
    );
    expect(result.businessDays).toHaveLength(5);
    expect(result.weekendCount).toBe(0);
  });

  it("two-week sickness including weekends = 10 days", () => {
    const r = makeHolidayResolver([]);
    const result = businessDaysInRange(
      new Date("2026-07-06T00:00:00Z"), // Mon
      new Date("2026-07-19T00:00:00Z"), // Sun (2 weeks)
      NW,
      r
    );
    expect(result.businessDays).toHaveLength(10);
    expect(result.weekendCount).toBe(4);
  });

  it("sickness over a public holiday excludes that day", () => {
    const holidays = [mkHoliday("2026-07-08")]; // Wed holiday
    const r = makeHolidayResolver(holidays);
    const result = businessDaysInRange(
      new Date("2026-07-06T00:00:00Z"), // Mon
      new Date("2026-07-10T00:00:00Z"), // Fri
      NW,
      r
    );
    expect(result.businessDays).toHaveLength(4);
    expect(result.holidayCount).toBe(1);
  });

  it("sickness spanning weekend only counts weekdays", () => {
    const r = makeHolidayResolver([]);
    const result = businessDaysInRange(
      new Date("2026-07-09T00:00:00Z"), // Thu
      new Date("2026-07-13T00:00:00Z"), // Mon
      NW,
      r
    );
    // Thu, Fri, (Sat, Sun skipped), Mon = 3 business days
    expect(result.businessDays).toHaveLength(3);
    expect(result.weekendCount).toBe(2);
  });

  it("sickness on a weekend-only range returns 0 business days", () => {
    const r = makeHolidayResolver([]);
    const result = businessDaysInRange(
      new Date("2026-07-04T00:00:00Z"), // Sat
      new Date("2026-07-05T00:00:00Z"), // Sun
      NW,
      r
    );
    expect(result.businessDays).toHaveLength(0);
    expect(result.weekendCount).toBe(2);
  });
});

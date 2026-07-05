import { describe, it, expect } from "vitest";
import {
  federalStateToNagerCode,
  nagerDateToPublicHoliday,
  shouldApplyForState,
  type NagerHoliday,
} from "./nager";
import type { FederalState } from "@prisma/client";

describe("federalStateToNagerCode", () => {
  it("maps all 16 states to Nager ISO codes", () => {
    const cases: [FederalState, string][] = [
      ["DE_BW", "BW"],
      ["DE_BY", "BY"],
      ["DE_BE", "BE"],
      ["DE_BB", "BB"],
      ["DE_HB", "HB"],
      ["DE_HE", "HE"],
      ["DE_HH", "HH"],
      ["DE_ME", "ME"],
      ["DE_MV", "MV"],
      ["DE_NI", "NI"],
      ["DE_NW", "NW"],
      ["DE_RP", "RP"],
      ["DE_SL", "SL"],
      ["DE_SN", "SN"],
      ["DE_ST", "ST"],
      ["DE_SH", "SH"],
      ["DE_TH", "TH"],
    ];
    for (const [state, code] of cases) {
      expect(federalStateToNagerCode(state)).toBe(code);
    }
  });
});

describe("nagerDateToPublicHoliday", () => {
  it("converts a Nager holiday into a PublicHoliday row (minus id/timestamps)", () => {
    const h: NagerHoliday = {
      date: "2026-01-01",
      localName: "Neujahr",
      name: "New Year's Day",
      countryCode: "DE",
      global: true,
      counties: null,
      launchYear: null,
      types: ["Public"],
    };
    const out = nagerDateToPublicHoliday(h, "DE_NW");
    expect(out.date).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(out.name).toBe("Neujahr");
    expect(out.federalState).toBe("DE_NW");
    expect(out.type).toBe("Public");
    expect(out.source).toBe("NAGER");
    expect(out.counties).toEqual([]);
    expect(out).not.toHaveProperty("id");
  });

  it("falls back to English name when localName is empty", () => {
    const h: NagerHoliday = {
      date: "2026-12-25",
      localName: "",
      name: "Christmas Day",
      countryCode: "DE",
      global: true,
      counties: ["DE-NW"],
      launchYear: null,
      types: ["Public"],
    };
    const out = nagerDateToPublicHoliday(h, "DE_NW");
    expect(out.name).toBe("Christmas Day");
    expect(out.counties).toEqual(["DE-NW"]);
  });
});

describe("shouldApplyForState", () => {
  it("manual entries apply only to their declared federalState", () => {
    expect(
      shouldApplyForState(
        { counties: [], federalState: "DE_NW", source: "MANUAL" },
        "DE_NW"
      )
    ).toBe(true);
    expect(
      shouldApplyForState(
        { counties: [], federalState: "DE_NW", source: "MANUAL" },
        "DE_BY"
      )
    ).toBe(false);
  });

  it("global NAGER holidays apply to the row's federalState", () => {
    expect(
      shouldApplyForState(
        { counties: [], federalState: "DE_NW", source: "NAGER" },
        "DE_NW"
      )
    ).toBe(true);
    expect(
      shouldApplyForState(
        { counties: [], federalState: "DE_NW", source: "NAGER" },
        "DE_BY"
      )
    ).toBe(false);
  });

  it("county-level NAGER holidays match by 'DE-XX' code in counties", () => {
    expect(
      shouldApplyForState(
        { counties: ["DE-NW", "DE-HE"], federalState: "DE_NW", source: "NAGER" },
        "DE_NW"
      )
    ).toBe(true);
    expect(
      shouldApplyForState(
        { counties: ["DE-NW", "DE-HE"], federalState: "DE_NW", source: "NAGER" },
        "DE_HE"
      )
    ).toBe(false);
    expect(
      shouldApplyForState(
        { counties: ["DE-NW"], federalState: "DE_NW", source: "NAGER" },
        "DE_BY"
      )
    ).toBe(false);
  });
});

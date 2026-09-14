import { describe, it, expect } from "vitest";
import {
  computePeriod,
  buildReportFileName,
  slugifyName,
  isSafeSubfolder,
} from "./automation-period";

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

describe("computePeriod (weekly)", () => {
  it("returns the previous Mon–Sun week for a ref mid-week", () => {
    // 14.09.2026 is a Monday; 07.–13.09.2026 is ISO week 37
    const p = computePeriod("WEEKLY", utc(2026, 9, 14));
    expect(p.periodKey).toBe("2026-W37");
    expect(p.from.toISOString()).toBe(new Date(Date.UTC(2026, 8, 7)).toISOString());
    expect(p.to.toISOString()).toBe(new Date(Date.UTC(2026, 8, 14)).toISOString());
  });

  it("handles year boundaries (ISO 8601: Dec 29 2025 belongs to 2026-W01)", () => {
    const p = computePeriod("WEEKLY", utc(2026, 1, 5)); // Monday, first week of 2026
    expect(p.periodKey).toBe("2026-W01");
    expect(p.from.toISOString()).toBe(new Date(Date.UTC(2025, 11, 29)).toISOString());
    expect(p.to.toISOString()).toBe(new Date(Date.UTC(2026, 0, 5)).toISOString());
  });

  it("is independent of the time of day", () => {
    const a = computePeriod("WEEKLY", new Date(Date.UTC(2026, 8, 16, 5, 30)));
    const b = computePeriod("WEEKLY", new Date(Date.UTC(2026, 8, 16, 22, 0)));
    expect(a.periodKey).toBe(b.periodKey);
  });
});

describe("computePeriod (monthly)", () => {
  it("returns the previous month and its bounds", () => {
    const p = computePeriod("MONTHLY", utc(2026, 9, 14));
    expect(p.periodKey).toBe("2026-08");
    expect(p.from.toISOString()).toBe(new Date(Date.UTC(2026, 7, 1)).toISOString());
    expect(p.to.toISOString()).toBe(new Date(Date.UTC(2026, 8, 1)).toISOString());
  });

  it("wraps to the previous year in January", () => {
    const p = computePeriod("MONTHLY", utc(2027, 1, 10));
    expect(p.periodKey).toBe("2026-12");
    expect(p.from.toISOString()).toBe(new Date(Date.UTC(2026, 11, 1)).toISOString());
    expect(p.to.toISOString()).toBe(new Date(Date.UTC(2027, 0, 1)).toISOString());
  });
});

describe("slugifyName / buildReportFileName", () => {
  it("slugifies umlauts and spaces into safe ascii", () => {
    expect(slugifyName("Jürgen Müßiggang")).toBe("juergen-muessiggang");
    expect(slugifyName("  Anna-Lena --- P.Boxer ")).toBe("anna-lena-p-boxer");
  });

  it("falls back when nothing is left", () => {
    expect(slugifyName("!!!")).toBe("unbekannt");
  });

  it("builds a deterministic file name", () => {
    expect(buildReportFileName({ userName: "Max Payne", periodKey: "2026-W37" })).toBe(
      "stundenzettel_max-payne_2026-W37.pdf"
    );
  });
});

describe("isSafeSubfolder", () => {
  it("allows nested folders, underscores and dashes", () => {
    expect(isSafeSubfolder("")).toBe(true);
    expect(isSafeSubfolder("brand/company")).toBe(true);
    expect(isSafeSubfolder("stundenzettel-2026")).toBe(true);
  });

  it("rejects traversal and odd input", () => {
    expect(isSafeSubfolder("..")).toBe(false);
    expect(isSafeSubfolder("a/../b")).toBe(false);
    expect(isSafeSubfolder("/a")).toBe(false);
    expect(isSafeSubfolder("a/")).toBe(false);
    expect(isSafeSubfolder("a ")).toBe(false);
    expect(isSafeSubfolder("p%20l')).jpg")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  computeAutoBreakMinutes,
  isManualBreakSufficient,
  resolveBreakMinutes,
  describeBreakRule,
  workedMsToMinutes,
  type BreakModel,
} from "@/lib/overtime/breaks";

const defaultModel: BreakModel = {
  autoBreakThreshold6h: true,
  autoBreakMinutes6h: 30,
  autoBreakThreshold9h: true,
  autoBreakMinutes9h: 45,
};

const H = 60 * 60_000;
const M = 60_000;

describe("workedMsToMinutes", () => {
  it("floors to minutes", () => {
    expect(workedMsToMinutes(0)).toBe(0);
    expect(workedMsToMinutes(59_999)).toBe(0);
    expect(workedMsToMinutes(60_000)).toBe(1);
    expect(workedMsToMinutes(90_000)).toBe(1);
    expect(workedMsToMinutes(120_000)).toBe(2);
  });
});

describe("computeAutoBreakMinutes (ArbZG §4)", () => {
  it("no break under 6h", () => {
    expect(computeAutoBreakMinutes(5 * H, defaultModel)).toBe(0);
    expect(computeAutoBreakMinutes(6 * H, defaultModel)).toBe(0); // exactly 6h, not >6h
  });

  it("30min break over 6h", () => {
    expect(computeAutoBreakMinutes(6 * H + 1, defaultModel)).toBe(30);
    expect(computeAutoBreakMinutes(7 * H, defaultModel)).toBe(30);
    expect(computeAutoBreakMinutes(9 * H, defaultModel)).toBe(30); // exactly 9h, not >9h
  });

  it("45min break over 9h", () => {
    expect(computeAutoBreakMinutes(9 * H + 1, defaultModel)).toBe(45);
    expect(computeAutoBreakMinutes(10 * H, defaultModel)).toBe(45);
  });

  it("respects disabled thresholds", () => {
    const noSix: BreakModel = { ...defaultModel, autoBreakThreshold6h: false };
    expect(computeAutoBreakMinutes(7 * H, noSix)).toBe(0);
    expect(computeAutoBreakMinutes(10 * H, noSix)).toBe(45);

    const noNine: BreakModel = { ...defaultModel, autoBreakThreshold9h: false };
    expect(computeAutoBreakMinutes(10 * H, noNine)).toBe(30); // falls back to 6h rule

    const none: BreakModel = {
      ...defaultModel,
      autoBreakThreshold6h: false,
      autoBreakThreshold9h: false,
    };
    expect(computeAutoBreakMinutes(10 * H, none)).toBe(0);
  });

  it("respects custom minutes", () => {
    const custom: BreakModel = { ...defaultModel, autoBreakMinutes6h: 15, autoBreakMinutes9h: 20 };
    expect(computeAutoBreakMinutes(7 * H, custom)).toBe(15);
    expect(computeAutoBreakMinutes(10 * H, custom)).toBe(20);
  });
});

describe("isManualBreakSufficient", () => {
  it("sufficient when manual >= minimum", () => {
    expect(isManualBreakSufficient(5 * H, 0, defaultModel)).toBe(true);
    expect(isManualBreakSufficient(7 * H, 30, defaultModel)).toBe(true);
    expect(isManualBreakSufficient(7 * H, 45, defaultModel)).toBe(true);
    expect(isManualBreakSufficient(10 * H, 45, defaultModel)).toBe(true);
    expect(isManualBreakSufficient(10 * H, 60, defaultModel)).toBe(true);
  });

  it("insufficient when below statutory minimum", () => {
    expect(isManualBreakSufficient(7 * H, 15, defaultModel)).toBe(false);
    expect(isManualBreakSufficient(7 * H, 0, defaultModel)).toBe(false);
    expect(isManualBreakSufficient(10 * H, 30, defaultModel)).toBe(false);
  });
});

describe("resolveBreakMinutes", () => {
  it("AUTO returns computed break", () => {
    const r = resolveBreakMinutes({
      breakMode: "AUTO",
      workedMs: 7 * H,
      model: defaultModel,
    });
    expect(r).toEqual({ minutes: 30, source: "auto", sufficient: true });
  });

  it("MANUAL uses provided minutes and validates", () => {
    const ok = resolveBreakMinutes({
      breakMode: "MANUAL",
      workedMs: 7 * H,
      manualBreakMinutes: 30,
      model: defaultModel,
    });
    expect(ok).toEqual({ minutes: 30, source: "manual", sufficient: true });

    const bad = resolveBreakMinutes({
      breakMode: "MANUAL",
      workedMs: 7 * H,
      manualBreakMinutes: 10,
      model: defaultModel,
    });
    expect(bad.sufficient).toBe(false);
    expect(bad.minutes).toBe(10);
  });

  it("MANUAL defaults to 0 when undefined", () => {
    const r = resolveBreakMinutes({
      breakMode: "MANUAL",
      workedMs: 7 * H,
      model: defaultModel,
    });
    expect(r.minutes).toBe(0);
    expect(r.sufficient).toBe(false);
  });
});

describe("describeBreakRule", () => {
  it("describes the active rule", () => {
    expect(describeBreakRule(5 * H, defaultModel)).toBe("no statutory break required");
    expect(describeBreakRule(7 * H, defaultModel)).toBe(">6h → 30min (ArbZG §4)");
    expect(describeBreakRule(10 * H, defaultModel)).toBe(">9h → 45min (ArbZG §4)");
  });
});

describe("edge cases", () => {
  it("negative workedMs treated as 0", () => {
    expect(computeAutoBreakMinutes(-1000, defaultModel)).toBe(0);
    expect(workedMsToMinutes(-1000)).toBe(0);
  });
});

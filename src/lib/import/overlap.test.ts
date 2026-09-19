import { describe, it, expect } from "vitest";
import { overlapsAnyInterval, dedupeKey, type Interval } from "./overlap";

const day = 24 * 60 * 60_000;
const at = (h: number, m = 0) => day + h * 60 * 60_000 + m * 60_000;

const intervals: Interval[] = [
  { startMs: at(8), endMs: at(12) },
  { startMs: at(13), endMs: at(17) },
];

describe("overlapsAnyInterval", () => {
  it("detects the exact same range as overlap", () => {
    expect(overlapsAnyInterval(at(8), at(12), intervals)).toBe(true);
  });

  it("detects partial overlap on either side", () => {
    expect(overlapsAnyInterval(at(7), at(9), intervals)).toBe(true);
    expect(overlapsAnyInterval(at(16), at(18), intervals)).toBe(true);
    expect(overlapsAnyInterval(at(11, 30), at(13, 30), intervals)).toBe(true);
  });

  it("detects an interval fully contained in an existing one", () => {
    expect(overlapsAnyInterval(at(9), at(10), intervals)).toBe(true);
  });

  it("flush edges and gaps do not overlap", () => {
    expect(overlapsAnyInterval(at(12), at(13), intervals)).toBe(false);
    expect(overlapsAnyInterval(at(6), at(8), intervals)).toBe(false);
    expect(overlapsAnyInterval(at(17), at(20), intervals)).toBe(false);
  });

  it("empty list never overlaps", () => {
    expect(overlapsAnyInterval(at(8), at(12), [])).toBe(false);
  });
});

describe("dedupeKey", () => {
  it("keys are equal for identical date/start/end", () => {
    expect(dedupeKey(1, 2, 3)).toBe(dedupeKey(1, 2, 3));
    expect(dedupeKey(1, 2, 3)).toBe("1|2|3");
  });
});

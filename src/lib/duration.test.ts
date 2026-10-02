import { describe, it, expect } from "vitest";
import { parseHMM, formatMinutesHMM, decimalHoursToHMM } from "./duration";

describe("parseHMM", () => {
  it("parses h:mm", () => {
    expect(parseHMM("7:39")).toBe(459);
    expect(parseHMM("07:39")).toBe(459);
    expect(parseHMM("0:15")).toBe(15);
    expect(parseHMM("0:01")).toBe(1);
  });

  it("parses decimals", () => {
    expect(parseHMM("7.5")).toBe(450);
    expect(parseHMM("7,5")).toBe(450);
    expect(parseHMM("7,25")).toBe(435);
    expect(parseHMM("7")).toBe(420);
  });

  it("rejects nonsense and overflows", () => {
    expect(parseHMM("abc")).toBeNull();
    expect(parseHMM("")).toBeNull();
    expect(parseHMM(null)).toBeNull();
    expect(parseHMM("7:75")).toBeNull();
    expect(parseHMM("-2:00")).toBeNull(); // regex disallows neg
  });
});

describe("formatMinutesHMM", () => {
  it("formats minutes exactly", () => {
    expect(formatMinutesHMM(459)).toBe("7:39");
    expect(formatMinutesHMM(0)).toBe("0:00");
    expect(formatMinutesHMM(60)).toBe("1:00");
    expect(formatMinutesHMM(-45)).toBe("-0:45");
    expect(formatMinutesHMM(1)).toBe("0:01");
  });
});

describe("decimalHoursToHMM", () => {
  it("roundtrips decimal hours minute-exact", () => {
    expect(decimalHoursToHMM(7.5)).toBe("7:30");
    expect(decimalHoursToHMM(7.77)).toBe("7:46"); // 7h46m20s → display 7:46
    expect(decimalHoursToHMM(0)).toBe("0:00");
  });
});

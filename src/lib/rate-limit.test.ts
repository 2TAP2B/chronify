import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const r1 = rateLimit({ key: "test-a", max: 3, windowMs: 10_000 });
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(2);
    const r2 = rateLimit({ key: "test-a", max: 3, windowMs: 10_000 });
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it("blocks the 4th request when max=3", () => {
    rateLimit({ key: "test-b", max: 3, windowMs: 10_000 });
    rateLimit({ key: "test-b", max: 3, windowMs: 10_000 });
    rateLimit({ key: "test-b", max: 3, windowMs: 10_000 });
    const r = rateLimit({ key: "test-b", max: 3, windowMs: 10_000 });
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("resets after the window elapses (fake timers)", () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start);
    rateLimit({ key: "test-c", max: 2, windowMs: 1_000 });
    rateLimit({ key: "test-c", max: 2, windowMs: 1_000 });
    const blocked = rateLimit({ key: "test-c", max: 2, windowMs: 1_000 });
    expect(blocked.ok).toBe(false);
    vi.setSystemTime(start + 1_500);
    const after = rateLimit({ key: "test-c", max: 2, windowMs: 1_000 });
    expect(after.ok).toBe(true);
    vi.useRealTimers();
  });

  it("isolates buckets by key", () => {
    rateLimit({ key: "user-1", max: 1, windowMs: 10_000 });
    const blocked = rateLimit({ key: "user-1", max: 1, windowMs: 10_000 });
    const other = rateLimit({ key: "user-2", max: 1, windowMs: 10_000 });
    expect(blocked.ok).toBe(false);
    expect(other.ok).toBe(true);
  });
});

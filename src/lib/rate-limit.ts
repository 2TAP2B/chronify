import "server-only";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

type LimitOptions = {
  key: string;
  max: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit({ key, max, windowMs }: LimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, max - existing.count);
  const ok = existing.count <= max;
  return { ok, remaining, resetAt: existing.resetAt };
}

export function rateLimitByIp(
  req: Request,
  opts: { key?: string; max: number; windowMs: number }
): RateLimitResult {
  const ip = getClientIp(req);
  return rateLimit({ ...opts, key: `${opts.key ?? "ip"}:${ip}` });
}

function getClientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export const LIMITS = {
  login: { max: 10, windowMs: 60_000 },
  mutation: { max: 60, windowMs: 60_000 },
  push: { max: 10, windowMs: 60_000 },
} as const;

export function rateLimitHeaders(result: RateLimitResult): Headers {
  const h = new Headers();
  h.set("X-RateLimit-Remaining", String(result.remaining));
  h.set("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));
  return h;
}

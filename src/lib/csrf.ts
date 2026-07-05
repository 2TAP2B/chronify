import "server-only";

const CSRF_MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutationMethod(method: string): boolean {
  return CSRF_MUTATION_METHODS.has(method.toUpperCase());
}

export type CsrfResult = { ok: true } | { ok: false; reason: string };

export function checkCsrfOrigin(
  origin: string | null,
  allowedOrigins: string[],
  expectedOrigin: string | null
): CsrfResult {
  if (!origin) {
    return { ok: false, reason: "missing_origin" };
  }

  let originHost: string;
  try {
    originHost = new URL(origin).origin;
  } catch {
    return { ok: false, reason: "invalid_origin" };
  }

  const isAllowed =
    allowedOrigins.includes(originHost) ||
    (expectedOrigin !== null && originHost === expectedOrigin);

  return isAllowed ? { ok: true } : { ok: false, reason: "origin_mismatch" };
}

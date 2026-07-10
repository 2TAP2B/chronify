export const MAX_DAILY_HOURS_REGULAR = 8;
export const MAX_DAILY_HOURS_EXTENDED = 10;
export const MIN_REST_HOURS = 11;

const HOUR_MS = 3_600_000;

export type ArbzgWarning = {
  level: "info" | "warning";
  key: "approachingMax" | "exceededMax" | "restPeriodShort";
  messageKey: string;
};

export function checkMaxDailyHours(workedMs: number): ArbzgWarning | null {
  const workedHours = workedMs / HOUR_MS;

  if (workedHours >= MAX_DAILY_HOURS_EXTENDED) {
    return {
      level: "warning",
      key: "exceededMax",
      messageKey: "arbzg.exceededMax",
    };
  }

  if (workedHours >= MAX_DAILY_HOURS_REGULAR) {
    return {
      level: "info",
      key: "approachingMax",
      messageKey: "arbzg.approachingMax",
    };
  }

  return null;
}

export function checkRestPeriod(
  lastWorkEndAt: string | null,
  now: Date = new Date()
): ArbzgWarning | null {
  if (!lastWorkEndAt) return null;

  const lastEndMs = new Date(lastWorkEndAt).getTime();
  const restMs = now.getTime() - lastEndMs;
  const restHours = restMs / HOUR_MS;

  if (restMs < 0) return null;

  if (restHours < MIN_REST_HOURS) {
    return {
      level: "warning",
      key: "restPeriodShort",
      messageKey: "arbzg.restPeriodShort",
    };
  }

  return null;
}
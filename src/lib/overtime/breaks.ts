export type BreakModel = {
  autoBreakThreshold6h: boolean;
  autoBreakMinutes6h: number;
  autoBreakThreshold9h: boolean;
  autoBreakMinutes9h: number;
};

export type BreakMode = "AUTO" | "MANUAL";

const H = 60 * 60_000;
const THRESHOLD_6H_MS = 6 * H;
const THRESHOLD_9H_MS = 9 * H;

export function clampPositive(v: number): number {
  return Math.max(0, v);
}

export function workedMsToMinutes(workedMs: number): number {
  return Math.floor(clampPositive(workedMs) / 60_000);
}

export function computeAutoBreakMinutes(workedMs: number, model: BreakModel): number {
  const worked = clampPositive(workedMs);
  if (model.autoBreakThreshold9h && worked > THRESHOLD_9H_MS) {
    return model.autoBreakMinutes9h;
  }
  if (model.autoBreakThreshold6h && worked > THRESHOLD_6H_MS) {
    return model.autoBreakMinutes6h;
  }
  return 0;
}

export function minRequiredBreakMinutes(workedMs: number, model: BreakModel): number {
  return computeAutoBreakMinutes(workedMs, model);
}

export function isManualBreakSufficient(
  workedMs: number,
  breakMinutes: number,
  model: BreakModel
): boolean {
  return breakMinutes >= minRequiredBreakMinutes(workedMs, model);
}

export function resolveBreakMinutes(opts: {
  breakMode: BreakMode;
  workedMs: number;
  manualBreakMinutes?: number;
  model: BreakModel;
}): { minutes: number; source: "auto" | "manual"; sufficient: boolean } {
  if (opts.breakMode === "AUTO") {
    const minutes = computeAutoBreakMinutes(opts.workedMs, opts.model);
    return { minutes, source: "auto", sufficient: true };
  }
  const manual = clampPositive(opts.manualBreakMinutes ?? 0);
  const sufficient = isManualBreakSufficient(opts.workedMs, manual, opts.model);
  return { minutes: manual, source: "manual", sufficient };
}

export function describeBreakRule(workedMs: number, model: BreakModel): string {
  const worked = clampPositive(workedMs);
  if (model.autoBreakThreshold9h && worked > THRESHOLD_9H_MS) {
    return `>9h → ${model.autoBreakMinutes9h}min (ArbZG §4)`;
  }
  if (model.autoBreakThreshold6h && worked > THRESHOLD_6H_MS) {
    return `>6h → ${model.autoBreakMinutes6h}min (ArbZG §4)`;
  }
  return "no statutory break required";
}

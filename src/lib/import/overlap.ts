export type Interval = { startMs: number; endMs: number };

/**
 * True when [startMs, endMs) intersects any of the given intervals.
 * Touching edges (end == start of the next) do NOT count as overlap.
 */
export function overlapsAnyInterval(
  startMs: number,
  endMs: number,
  intervals: Interval[]
): boolean {
  for (const iv of intervals) {
    if (startMs < iv.endMs && endMs > iv.startMs) return true;
  }
  return false;
}

/**
 * True when the given key string matches any of the already-present keys
 * (in-file dedupe).
 */
export function dedupeKey(dateMs: number, startMs: number, endMs: number): string {
  return `${dateMs}|${startMs}|${endMs}`;
}

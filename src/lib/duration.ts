/**
 * Minute-exact duration helpers shared by working models, entry dialogs and
 * the PDF report. Canonical storage unit is minutes (Int).
 */

/** "7:39" | "07:39" | "7,5" | "7.5" → minutes (rounded). null when invalid. */
export function parseHMM(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).trim();
  if (cleaned === "") return null;

  const col = /^(\d{1,3}):(\d{1,2})$/.exec(cleaned);
  if (col) {
    const h = parseInt(col[1], 10);
    const m = parseInt(col[2].padStart(2, "0"), 10);
    if (m > 59) return null;
    return h * 60 + m;
  }

  const dec = /^(\d{1,3})([.,](\d{1,2}))?$/.exec(cleaned);
  if (dec) {
    const h = parseInt(dec[1], 10);
    const frac = dec[3] ?? "0";
    const m = Math.round((parseInt(frac.padEnd(2, "0"), 10) / 100) * 60);
    return h * 60 + m;
  }
  return null;
}

/** minutes → "H:MM" (e.g. 459 → "7:39"); negative-safe. */
export function formatMinutesHMM(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/** Decimal-hours number (e.g. 7.5) → "7:30"; carries sub-36s rounding. */
export function decimalHoursToHMM(decimalHours: number): string {
  return formatMinutesHMM(Math.round(decimalHours * 60));
}

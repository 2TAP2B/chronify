import { db } from "@/lib/db";
import { federalStateToNagerCode, nagerDateToPublicHoliday, type NagerHoliday } from "@/lib/holidays/nager";
import type { FederalState } from "@prisma/client";

export type HolidaySyncResult = {
  state: FederalState;
  year: number;
  fetched: number;
  upserted: number;
  manualOverrides: number;
};

export async function fetchNagerHolidays(
  year: number,
  countryCode = "DE"
): Promise<NagerHoliday[]> {
  const url = `${process.env.NAGER_DATE_API_URL ?? "https://date.nager.at/api/v3"}/PublicHolidays/${year}/${countryCode}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) {
    throw new Error(`nager.date fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function syncHolidaysForState(
  year: number,
  federalState: FederalState,
  countryCode = "DE"
): Promise<HolidaySyncResult> {
  const allHolidays = await fetchNagerHolidays(year, countryCode);
  const stateCode = `DE-${federalStateToNagerCode(federalState)}`;
  // Filter holidays that apply to this state: global OR counties contains state code
  const applicable = allHolidays.filter((h) => {
    if (!h.counties || h.counties.length === 0) return true; // global
    return h.counties.includes(stateCode);
  });
  const mapped = applicable.map((h) => nagerDateToPublicHoliday(h, federalState));

  let upserted = 0;
  for (const h of mapped) {
    await db.publicHoliday.upsert({
      where: {
        date_federalState: { date: h.date, federalState: h.federalState },
      },
      update: {
        name: h.name,
        type: h.type,
        counties: h.counties,
        // Don't overwrite manual overrides - only update NAGER source entries
        ...(h.source === "NAGER" ? { source: "NAGER" } : {}),
      },
      create: h,
    });
    upserted++;
  }

  const manualOverrides = await db.publicHoliday.count({
    where: { federalState, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }, source: "MANUAL" },
  });

  return {
    state: federalState,
    year,
    fetched: applicable.length,
    upserted,
    manualOverrides,
  };
}

export async function syncAllUserStates(year: number): Promise<HolidaySyncResult[]> {
  // Get all distinct federal states present on users
  const users = await db.user.findMany({
    where: { active: true },
    select: { federalState: true },
    distinct: ["federalState"],
  });
  const results: HolidaySyncResult[] = [];
  for (const u of users) {
    const r = await syncHolidaysForState(year, u.federalState);
    results.push(r);
  }
  return results;
}

export async function listHolidays(opts: {
  federalState: FederalState;
  from?: Date;
  to?: Date;
}) {
  const where: Record<string, unknown> = { federalState: opts.federalState };
  if (opts.from || opts.to) {
    where.date = {};
    if (opts.from) (where.date as { gte: Date }).gte = opts.from;
    if (opts.to) (where.date as { lte: Date }).lte = opts.to;
  }
  return db.publicHoliday.findMany({
    where: where as never,
    orderBy: { date: "asc" },
  });
}

export async function upsertManualHoliday(opts: {
  date: Date;
  name: string;
  federalState: FederalState;
  type?: string;
  counties?: string[];
}) {
  return db.publicHoliday.upsert({
    where: {
      date_federalState: { date: opts.date, federalState: opts.federalState },
    },
    update: {
      name: opts.name,
      type: opts.type ?? "Public",
      source: "MANUAL",
      counties: opts.counties ?? [],
    },
    create: {
      date: opts.date,
      name: opts.name,
      federalState: opts.federalState,
      type: opts.type ?? "Public",
      source: "MANUAL",
      counties: opts.counties ?? [],
    },
  });
}

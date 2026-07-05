import type { FederalState, PublicHoliday } from "@prisma/client";

const NAGER_STATE_MAP: Record<FederalState, string> = {
  DE_BW: "BW",
  DE_BY: "BY",
  DE_BE: "BE",
  DE_BB: "BB",
  DE_HB: "HB",
  DE_HE: "HE",
  DE_HH: "HH",
  DE_ME: "ME",
  DE_MV: "MV",
  DE_NI: "NI",
  DE_NW: "NW",
  DE_RP: "RP",
  DE_SL: "SL",
  DE_SN: "SN",
  DE_ST: "ST",
  DE_SH: "SH",
  DE_TH: "TH",
};

export function federalStateToNagerCode(state: FederalState): string {
  return NAGER_STATE_MAP[state];
}

export type NagerHoliday = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
};

export function nagerDateToPublicHoliday(
  h: NagerHoliday,
  federalState: FederalState
): Omit<PublicHoliday, "id" | "createdAt" | "updatedAt"> {
  return {
    date: new Date(`${h.date}T00:00:00Z`),
    name: h.localName || h.name,
    federalState,
    type: "Public",
    source: "NAGER",
    counties: h.counties ?? [],
  };
}

export function shouldApplyForState(
  holiday: { counties: string[]; federalState: FederalState; source: string },
  requestedState: FederalState
): boolean {
  // Manual entries always apply to their declared federalState.
  if (holiday.source === "MANUAL") {
    return holiday.federalState === requestedState;
  }
  // NAGER: global holidays apply to all states.
  if (!holiday.counties || holiday.counties.length === 0) {
    return holiday.federalState === requestedState;
  }
  // County-level: check if the state code appears (format "DE-XX").
  const code = `DE-${federalStateToNagerCode(requestedState)}`;
  return holiday.federalState === requestedState && holiday.counties.includes(code);
}

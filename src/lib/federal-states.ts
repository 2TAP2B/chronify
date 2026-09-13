export const STATE_NAMES: Record<string, string> = {
  DE_BW: "Baden-Württemberg",
  DE_BY: "Bayern",
  DE_BE: "Berlin",
  DE_BB: "Brandenburg",
  DE_HB: "Bremen",
  DE_HE: "Hessen",
  DE_HH: "Hamburg",
  DE_ME: "Mecklenburg-Vorpommern",
  DE_MV: "Mecklenburg-Vorpommern",
  DE_NI: "Niedersachsen",
  DE_NW: "Nordrhein-Westfalen",
  DE_RP: "Rheinland-Pfalz",
  DE_SL: "Saarland",
  DE_SN: "Sachsen",
  DE_ST: "Sachsen-Anhalt",
  DE_SH: "Schleswig-Holstein",
  DE_TH: "Thüringen",
};

export const STATE_CODES = Object.keys(STATE_NAMES);

export function stateName(code: string): string {
  return STATE_NAMES[code] ?? code;
}

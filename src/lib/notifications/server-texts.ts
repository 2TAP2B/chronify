export type NotificationLocale = "de" | "en";

export type NotificationKind =
  | "vacationApproved"
  | "vacationRejected"
  | "vacationRequested"
  | "closureChoice"
  | `arbzg:${string}`;

const ARBZG_TITLES_BODIES: Record<
  string,
  Record<NotificationLocale, { title: string; body: string }>
> = {
  approachingMax: {
    de: {
      title: "ArbZG: Mehr als 8 Stunden gearbeitet",
      body: "Sie haben heute mehr als 8 Stunden gearbeitet. Ab 10 Stunden ist die gesetzliche Höchstarbeitszeit erreicht (§3 ArbZG).",
    },
    en: {
      title: "ArbZG: More than 8 hours worked",
      body: "You have worked more than 8 hours today. At 10 hours the statutory maximum working time is reached (§3 ArbZG).",
    },
  },
  exceededMax: {
    de: {
      title: "ArbZG: Höchstarbeitszeit überschritten (10h)",
      body: "Die gesetzliche Höchstarbeitszeit von 10 Stunden pro Tag wurde überschritten (§3 ArbZG). Bitte informieren Sie Ihren Vorgesetzten.",
    },
    en: {
      title: "ArbZG: Maximum working time exceeded (10h)",
      body: "The statutory maximum working time of 10 hours per day has been exceeded (§3 ArbZG). Please inform your supervisor.",
    },
  },
  restPeriodShort: {
    de: {
      title: "ArbZG: Ruhezeit unter 11 Stunden",
      body: "Seit dem Ende der letzten Schicht sind noch keine 11 Stunden Ruhezeit vergangen (§5 ArbZG).",
    },
    en: {
      title: "ArbZG: Rest period below 11 hours",
      body: "Less than 11 hours of rest period have passed since the end of the last shift (§5 ArbZG).",
    },
  },
};

export function arbzgWarningText(
  warningKey: string,
  locale: NotificationLocale
): { title: string; body: string } | null {
  const entry = ARBZG_TITLES_BODIES[warningKey];
  if (!entry) return null;
  return entry[locale] ?? entry.de;
}

export function notificationText(
  kind: NotificationKind,
  locale: NotificationLocale,
  params: {
    /** Vacation approve/reject/request + closure day count */
    fromDate?: string;
    toDate?: string;
    /** vacationRequested: requester display name */
    actorName?: string;
    /** requested/closureChoice: number of business days */
    days?: number;
    /** closureChoice: business closure name */
    closureName?: string;
  }
): { title: string; body: string } {
  const from = params.fromDate ?? "";
  const to = params.toDate ?? "";
  const days = params.days ?? 0;

  switch (kind) {
    case "vacationApproved":
      return locale === "en"
        ? { title: "Vacation approved", body: `Vacation ${from} – ${to} has been approved.` }
        : { title: "Urlaub genehmigt", body: `Urlaub ${from} – ${to} wurde genehmigt.` };
    case "vacationRejected":
      return locale === "en"
        ? { title: "Vacation rejected", body: `Vacation ${from} – ${to} was rejected.` }
        : { title: "Urlaub abgelehnt", body: `Urlaub ${from} – ${to} wurde abgelehnt.` };
    case "vacationRequested":
      return locale === "en"
        ? {
            title: "New vacation request",
            body: `${params.actorName ?? ""} requested ${days} day(s) of vacation (${from} – ${to})`,
          }
        : {
            title: "Neuer Urlaubsantrag",
            body: `${params.actorName ?? ""} beantragt ${days} Tag(e) Urlaub (${from} – ${to})`,
          };
    case "closureChoice":
      return locale === "en"
        ? {
            title: "Business closure",
            body: `${params.closureName ?? ""}: ${days} day(s) were submitted as vacation. You can compensate with overtime instead.`,
          }
        : {
            title: "Schließtag",
            body: `${params.closureName ?? ""}: ${days} Tag(e) wurden als Urlaub eingetragen. Du kannst stattdessen Überstunden abbauen.`,
          };
    default:
      throw new Error(`Unknown notification kind: ${kind}`);
  }
}

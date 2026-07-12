import { formatDistanceToNow as dateFnsFormat } from "date-fns";
import { de, enUS } from "date-fns/locale";

export function formatDistanceToNow(
  date: Date,
  locale: "de" | "en" = "de"
): string {
  return dateFnsFormat(date, {
    addSuffix: true,
    locale: locale === "de" ? de : enUS,
  });
}
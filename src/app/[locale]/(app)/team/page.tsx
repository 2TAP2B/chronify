import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getTeamCalendar, type TeamCalendarDay } from "@/server/services/team";
import { TeamCalendar } from "@/components/team/team-calendar";
import { TeamPdfExport } from "@/components/team/team-pdf-export";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
};

const MONTH_NAMES_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function TeamPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("team");
  const session = await auth();
  if (!session?.user?.id) return null;

  const { year: yearStr, month: monthStr } = await searchParams;
  const now = new Date();
  const year = yearStr ? Number(yearStr) : now.getUTCFullYear();
  const month = monthStr ? Number(monthStr) : now.getUTCMonth() + 1;

  const { days, users } = await getTeamCalendar({
    actor: { id: session.user.id, role: session.user.role },
    year,
    month,
  });

  const monthNames = appLocale === "en" ? MONTH_NAMES_EN : MONTH_NAMES_DE;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <a href={`?year=${prevYear}&month=${prevMonth}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">←</a>
          <span className="font-semibold">{monthNames[month - 1]} {year}</span>
          <a href={`?year=${nextYear}&month=${nextMonth}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">→</a>
          <TeamPdfExport year={year} month={month} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("whoIsOff")}</CardTitle>
          <CardDescription>{monthNames[month - 1]} {year} · {users.length} {t("users")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-200" /> {t("vacation")}</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-200" /> {t("sick")}</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-200" /> {t("holiday")}</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200" /> {t("closure")}</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-muted" /> {t("weekend")}</span>
          </div>
          <TeamCalendar days={days as TeamCalendarDay[]} users={users} />
        </CardContent>
      </Card>
    </div>
  );
}

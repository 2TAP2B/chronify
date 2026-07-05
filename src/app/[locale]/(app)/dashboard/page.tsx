import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/server/context";
import {
  toCalendarDate,
  startOfWeekUtc,
  addDaysUtc,
  formatInZone,
} from "@/lib/datetime";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimerWidget } from "@/components/timer/timer-widget";
import { msToHours } from "@/lib/timer-utils";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user, settings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    getOrgSettings(),
  ]);
  const timeZone = user.timezone || "Europe/Berlin";
  const now = new Date();

  const todayStart = toCalendarDate(now, timeZone);
  const weekStart = startOfWeekUtc(now, timeZone);
  const weekEnd = addDaysUtc(weekStart, 7);

  const [todayEntries, weekEntries] = await Promise.all([
    db.timeEntry.findMany({
      where: { userId: user.id, date: { gte: todayStart, lt: addDaysUtc(todayStart, 1) } },
    }),
    db.timeEntry.findMany({
      where: { userId: user.id, date: { gte: weekStart, lt: weekEnd } },
    }),
  ]);

  const sumWorkedMs = (entries: typeof todayEntries) =>
    entries.reduce((sum, e) => {
      if (e.type !== "WORK" || !e.startAt || !e.endAt) return sum;
      const gross = e.endAt.getTime() - e.startAt.getTime();
      return sum + Math.max(0, gross - e.breakMinutes * 60_000);
    }, 0);

  const todayMs = sumWorkedMs(todayEntries);
  const weekMs = sumWorkedMs(weekEntries);

  const weekLabel = `${formatInZone(weekStart, timeZone, "dd.MM.", locale as "de" | "en")} – ${formatInZone(
    addDaysUtc(weekEnd, -1),
    timeZone,
    "dd.MM.yyyy",
    locale as "de" | "en"
  )}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("welcome", { name: user.name })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("todayWorked")}</CardDescription>
            <CardTitle className="text-2xl font-mono tabular-nums">
              {(msToHours(todayMs)).toFixed(2)} h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{t("today")}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("weekWorked")}</CardDescription>
            <CardTitle className="text-2xl font-mono tabular-nums">
              {(msToHours(weekMs)).toFixed(2)} h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{weekLabel}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("overtimeBalance")}</CardDescription>
            <CardTitle className="text-2xl font-mono tabular-nums">00:00</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("vacationRemaining")}</CardDescription>
            <CardTitle className="text-2xl">
              {settings.defaultVacationDays} Tage
            </CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
      </div>

      <TimerWidget />

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("noTimerRunning")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Stundenzettel unter „Stundenzettel&quot;.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/server/context";
import { computeYearOvertime } from "@/server/services/overtime";
import {
  toCalendarDate,
  startOfWeekUtc,
  addDaysUtc,
  formatInZone,
} from "@/lib/datetime";
import { msToHours } from "@/lib/timer-utils";
import { TimerWidget } from "@/components/timer/timer-widget";
import { MobileTimerHero } from "@/components/timer/mobile-timer-hero";
import { SectionCards, type SectionCardsData } from "@/components/section-cards";
import { LiveSectionCards } from "@/components/live-section-cards";
import {
  ChartAreaInteractive,
  type ChartPoint,
} from "@/components/chart-area-interactive";
import { DataTable, type TimeEntryRow } from "@/components/data-table";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const tTimesheet = await getTranslations("timesheet");
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user, settings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    getOrgSettings(),
  ]);
  const timeZone = user.timezone || "Europe/Berlin";
  const now = new Date();
  const year = now.getUTCFullYear();

  const todayStart = toCalendarDate(now, timeZone);
  const weekStart = startOfWeekUtc(now, timeZone);
  const weekEnd = addDaysUtc(weekStart, 7);

  const chartStart = addDaysUtc(todayStart, -90);

  const [todayEntries, weekEntries, recentEntries, chartEntries, overtimeResult] =
    await Promise.all([
      db.timeEntry.findMany({
        where: {
          userId: user.id,
          date: { gte: todayStart, lt: addDaysUtc(todayStart, 1) },
        },
      }),
      db.timeEntry.findMany({
        where: {
          userId: user.id,
          date: { gte: weekStart, lt: weekEnd },
        },
      }),
      db.timeEntry.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 20,
      }),
      db.timeEntry.findMany({
        where: {
          userId: user.id,
          date: { gte: chartStart, lte: todayStart },
        },
      }),
      computeYearOvertime({
        userId: user.id,
        year,
        timeZone,
      }).catch(() => null),
    ]);

  const sumWorkedMs = (
    entries: typeof todayEntries
  ) =>
    entries.reduce((sum, e) => {
      if (e.type !== "WORK" || !e.startAt || !e.endAt) return sum;
      const gross = e.endAt.getTime() - e.startAt.getTime();
      return sum + Math.max(0, gross - e.breakMinutes * 60_000);
    }, 0);

  const todayMs = sumWorkedMs(todayEntries);
  const weekMs = sumWorkedMs(weekEntries);

  const workingModel = await db.workingModel.findFirst({
    where: {
      userId: user.id,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: { validFrom: "desc" },
  });

  const dayNames = [
    "sundayMinutes",
    "mondayMinutes",
    "tuesdayMinutes",
    "wednesdayMinutes",
    "thursdayMinutes",
    "fridayMinutes",
    "saturdayMinutes",
  ] as const;
  const todayDow = new Date(
    toCalendarDate(now, timeZone)
  ).getDay();
  const todayTargetMs =
    (workingModel?.[dayNames[todayDow]] ?? 0) * 60_000;

  const weekTargetMs = workingModel
    ? (workingModel.mondayMinutes +
        workingModel.tuesdayMinutes +
        workingModel.wednesdayMinutes +
        workingModel.thursdayMinutes +
        workingModel.fridayMinutes +
        workingModel.saturdayMinutes +
        workingModel.sundayMinutes) *
      60_000
    : 0;

  const overtimeHours = overtimeResult
    ? overtimeResult.computation.balanceMs / 3_600_000
    : 0;

  const vacationEntitlement = await db.vacationEntitlement.findUnique({
    where: { userId_year: { userId: user.id, year } },
  });

  const vacationTotal = vacationEntitlement?.totalDays ?? settings.defaultVacationDays;
  const vacationConsumed = vacationEntitlement?.consumedDays ?? 0;
  const vacationRemaining = Math.max(0, vacationTotal - vacationConsumed);

  const cardsData: SectionCardsData = {
    todayHours: msToHours(todayMs),
    todayTargetHours: msToHours(todayTargetMs),
    weekHours: msToHours(weekMs),
    weekTargetHours: msToHours(weekTargetMs),
    overtimeHours,
    overtimeTrend:
      overtimeHours > 0 ? "up" : overtimeHours < 0 ? "down" : "neutral",
    vacationRemaining,
    vacationTotal,
  };

  const chartData: ChartPoint[] = [];
  const days90 = 90;
  for (let i = days90; i >= 0; i--) {
    const dayStart = addDaysUtc(todayStart, -i);
    const dayEnd = addDaysUtc(dayStart, 1);
    const dayEntries = chartEntries.filter(
      (e) => e.date >= dayStart && e.date < dayEnd
    );
    const workedMs = sumWorkedMs(dayEntries);
    const dow = new Date(dayStart).getDay();
    const targetMs = (workingModel?.[dayNames[dow]] ?? 0) * 60_000;
    chartData.push({
      date: dayStart.toISOString().slice(0, 10),
      hours: Math.round(msToHours(workedMs) * 100) / 100,
      target: Math.round(msToHours(targetMs) * 100) / 100,
    });
  }

  const tableRows: TimeEntryRow[] = recentEntries.map((e) => {
    const durationMs =
      e.type === "WORK" && e.startAt && e.endAt
        ? Math.max(
            0,
            e.endAt.getTime() -
              e.startAt.getTime() -
              e.breakMinutes * 60_000
          )
        : 0;
    return {
      id: e.id,
      date: formatInZone(e.date, timeZone, "dd.MM.yyyy", locale as "de" | "en"),
      type: e.type,
      start: e.startAt
        ? formatInZone(e.startAt, timeZone, "HH:mm", locale as "de" | "en")
        : null,
      end: e.endAt
        ? formatInZone(e.endAt, timeZone, "HH:mm", locale as "de" | "en")
        : null,
      breakMinutes: e.breakMinutes,
      durationHours: msToHours(durationMs),
      note: e.note,
    };
  });

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("welcome", { name: user.name })}
        </p>
      </div>

      <MobileTimerHero
        userName={user.name}
        todayWorkedMs={todayMs}
        todayTargetHours={msToHours(todayTargetMs)}
        locale={locale}
      />

       <LiveSectionCards
           data={cardsData}
          labels={{
            todayWorked: t("todayWorked"),
            weekWorked: t("weekWorked"),
            overtimeBalance: t("overtimeBalance"),
            vacationRemaining: t("vacationRemaining"),
            dailyTarget: t("dailyTarget"),
            weekTarget: t("weeklyTarget"),
            days: t("days"),
          }}
        />

      <div className="hidden lg:block">
        <TimerWidget />
      </div>

      <ChartAreaInteractive
        data={chartData}
        labels={{
          title: t("chartTitle"),
          description: t("chartDescription"),
          last3Months: t("last3Months"),
          last30Days: t("last30Days"),
          last7Days: t("last7Days"),
          worked: t("chartWorked"),
          target: t("chartTarget"),
        }}
      />

      <DataTable
        data={tableRows}
        labels={{
          title: t("recentEntries"),
          date: tTimesheet("day"),
          type: tTimesheet("type"),
          start: tTimesheet("start"),
          end: tTimesheet("end"),
          break: tTimesheet("break"),
          duration: tTimesheet("duration"),
          note: tTimesheet("note"),
          noEntries: tTimesheet("noEntries"),
          types: {
            WORK: tTimesheet("types.WORK"),
            VACATION: tTimesheet("types.VACATION"),
            SICK: tTimesheet("types.SICK"),
            PUBLIC_HOLIDAY: tTimesheet("types.PUBLIC_HOLIDAY"),
            PERSONAL: tTimesheet("types.PERSONAL"),
          },
          tabs: {
            all: t("tabs.all"),
            work: t("tabs.work"),
            vacation: t("tabs.vacation"),
            sick: t("tabs.sick"),
          },
        }}
      />
    </div>
  );
}

import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/server/context";
import {
  toCalendarDate,
  startOfWeekUtc,
  addDaysUtc,
  formatInZone,
} from "@/lib/datetime";
import { isEntryLocked } from "@/lib/timer-utils";
import { TimesheetGrid } from "@/components/timesheet/timesheet-grid";
import { UserSelector } from "@/components/timesheet/user-selector";
import { TimesheetDatePicker } from "@/components/timesheet/timesheet-date-picker";
import type { TimeEntryType } from "@prisma/client";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; userId?: string }>;
};

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

export default async function TimesheetPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const appLocale = (await getLocale()) as "de" | "en";
  const t = await getTranslations("timesheet");
  const session = await auth();
  if (!session?.user?.id) return null;

  const { date: dateParam, userId: userIdParam } = await searchParams;
  const reference = dateParam ? new Date(dateParam) : new Date();
  if (isNaN(reference.getTime())) return null;

  const isAdmin = session.user.role === "ADMIN";
  const targetUserId = isAdmin && userIdParam ? userIdParam : session.user.id;

  const [user, settings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: targetUserId } }),
    getOrgSettings(),
  ]);
  const timeZone = user.timezone || "Europe/Berlin";
  const lockWindowDays = settings.timeEntryLockWindowDays;

  const weekStart = startOfWeekUtc(reference, timeZone);
  const weekEnd = addDaysUtc(weekStart, 7);

  const entries = await db.timeEntry.findMany({
    where: {
      userId: user.id,
      date: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { date: "asc" },
  });

  const users = isAdmin
    ? await db.user.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDaysUtc(weekStart, i);
    const dayEntries = entries
      .filter((e) => toCalendarDate(e.date, timeZone).getTime() === day.getTime())
      .map((e) => ({
        id: e.id,
        date: e.date.toISOString(),
        startAt: e.startAt?.toISOString() ?? null,
        endAt: e.endAt?.toISOString() ?? null,
        breakMinutes: e.breakMinutes,
        type: e.type as TimeEntryType,
        note: e.note,
        source: e.source,
        locked: !isAdmin && isEntryLocked(e.date, lockWindowDays),
      }));
    return {
      date: day.toISOString(),
      label: formatInZone(day, timeZone, "EEEEEE dd.MM.", appLocale),
      isToday: toCalendarDate(new Date(), timeZone).getTime() === day.getTime(),
      entries: dayEntries,
    };
  });

  const prevDate = addDaysUtc(weekStart, -7).toISOString().slice(0, 10);
  const nextDate = addDaysUtc(weekStart, 7).toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);
  const kw = getISOWeek(weekStart);
  const weekLabel = `${t("calendarWeek")} ${kw} · ${formatInZone(weekStart, timeZone, "dd.MM.yyyy", appLocale)} – ${formatInZone(
    addDaysUtc(weekEnd, -1),
    timeZone,
    "dd.MM.yyyy",
    appLocale
  )}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <a
            href={`?date=${prevDate}${userIdParam ? `&userId=${userIdParam}` : ""}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            ← {t("previousWeek")}
          </a>
          <TimesheetDatePicker
            value={weekStart}
            userId={userIdParam}
          />
          <a
            href={`?date=${todayIso}${userIdParam ? `&userId=${userIdParam}` : ""}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {t("today")}
          </a>
          <a
            href={`?date=${nextDate}${userIdParam ? `&userId=${userIdParam}` : ""}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {t("nextWeek")} →
          </a>
        </div>
      </div>

      {isAdmin && (
        <UserSelector currentUserId={session.user.id} users={users} />
      )}
      <p className="text-sm text-muted-foreground">{weekLabel}</p>
      <p className="text-xs text-muted-foreground">
        {t("lockedHint", { days: lockWindowDays })}
      </p>
      <TimesheetGrid
        days={days}
        timeZone={timeZone}
        lockWindowDays={lockWindowDays}
        adminUserId={isAdmin ? targetUserId : undefined}
      />
    </div>
  );
}

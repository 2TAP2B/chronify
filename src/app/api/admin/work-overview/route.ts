import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { computeYearOvertime } from "@/server/services/overtime";
import { db } from "@/lib/db";
import { toCalendarDate } from "@/lib/datetime";

type MonthBucket = {
  month: number;
  workedMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number;
  vacationDays: number;
  sickDays: number;
};

function emptyMonths(): MonthBucket[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    workedMinutes: 0,
    targetMinutes: 0,
    overtimeMinutes: 0,
    vacationDays: 0,
    sickDays: 0,
  }));
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const year = url.searchParams.get("year");
    if (!userId || !year) {
      return NextResponse.json({ error: "userId and year required" }, { status: 400 });
    }
    const yearNum = Number(year);

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, active: true },
    });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Compute overtime stats + per-business-day summaries (worked/target/delta).
    const tz =
      (
        await db.user.findUnique({
          where: { id: userId },
          select: { timezone: true, federalState: true },
        })
      )?.timezone ?? "Europe/Berlin";
    const { computation, days: daySummaries } = await computeYearOvertime({
      userId,
      year: yearNum,
      timeZone: tz,
    });

    // Worked/target/overtime: aggregate the per-day summaries by month.
    const months = emptyMonths();
    for (const d of daySummaries) {
      const month = d.date.getUTCMonth() + 1;
      const bucket = months[month - 1];
      bucket.workedMinutes += Math.floor(d.workedMs / 60_000);
      bucket.targetMinutes += d.targetMinutes;
      bucket.overtimeMinutes += Math.round(d.deltaMs / 60_000);
    }

    // Vacation / sick: count distinct days with VACATION/SICK TimeEntries per month.
    const absences = await db.timeEntry.findMany({
      where: {
        userId,
        date: {
          gte: new Date(Date.UTC(yearNum, 0, 1)),
          lt: new Date(Date.UTC(yearNum + 1, 0, 1)),
        },
        type: { in: ["VACATION", "SICK"] },
      },
      select: { date: true, type: true },
    });
    // Dedupe by calendar day so a multi-day entry spanning months still
    // counts each day exactly once.
    for (const a of absences) {
      const day = toCalendarDate(a.date, tz);
      const month = new Date(day.getTime()).getUTCMonth() + 1;
      if (a.type === "VACATION") months[month - 1].vacationDays += 1;
      else if (a.type === "SICK") months[month - 1].sickDays += 1;
    }

    const totals = months.reduce(
      (acc, m) => {
        acc.workedMinutes += m.workedMinutes;
        acc.targetMinutes += m.targetMinutes;
        acc.overtimeMinutes += m.overtimeMinutes;
        acc.vacationDays += m.vacationDays;
        acc.sickDays += m.sickDays;
        return acc;
      },
      { workedMinutes: 0, targetMinutes: 0, overtimeMinutes: 0, vacationDays: 0, sickDays: 0 }
    );

    return NextResponse.json({
      user: target,
      year: yearNum,
      months,
      totals,
      carriedOverMinutes: computation.carriedOverMinutes,
      consumedOvertimeMinutes: computation.consumedOvertimeMinutes,
      balanceMs: computation.balanceMs,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

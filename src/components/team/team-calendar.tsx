"use client";

import { useTranslations } from "next-intl";
import type { TeamCalendarDay } from "@/server/services/team";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_COLORS: Record<string, string> = {
  VACATION: "bg-blue-100 text-blue-800 border-blue-200",
  SICK: "bg-red-100 text-red-800 border-red-200",
  PUBLIC_HOLIDAY: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const TYPE_LABELS: Record<string, string> = {
  VACATION: "U",
  SICK: "K",
  PUBLIC_HOLIDAY: "F",
};

export function TeamCalendar({
  days,
  users,
}: {
  days: TeamCalendarDay[];
  users: { id: string; name: string }[];
}) {
  const t = useTranslations("team");

  // Group by ISO weekday (1=Mon..7=Sun), but our days array is already in calendar order.
  // We'll render a grid: each column is a day, each row is a user.
  // For a compact view, render days as columns (max 31) and users as rows.

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-r bg-background p-2 text-left font-medium">
              {t("users")}
            </th>
            {days.map((d) => {
              const dayNum = Number(d.date.slice(8, 10));
              const weekdayIdx = d.weekday === 0 ? 6 : d.weekday - 1; // Mon=0..Sun=6
              return (
                <th
                  key={d.date}
                  className={`border-b border-r p-1 text-center font-medium min-w-[40px] ${
                    d.isWeekend ? "bg-muted/50" : d.isHoliday ? "bg-emerald-50" : "bg-background"
                  }`}
                  title={d.holidayName ?? ""}
                >
                  <div className="text-[10px] text-muted-foreground">{WEEKDAY_LABELS[weekdayIdx]}</div>
                  <div>{dayNum}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-muted/30">
              <td className="sticky left-0 z-10 border-b border-r bg-background p-2 font-medium whitespace-nowrap">
                {u.name}
              </td>
              {days.map((d) => {
                const entry = d.entries.find((e) => e.userId === u.id);
                const weekdayIdx = d.weekday === 0 ? 6 : d.weekday - 1;
                const isWeekend = d.isWeekend;
                const isHoliday = d.isHoliday && entry?.type === "PUBLIC_HOLIDAY";
                let cellClass = "border-b border-r p-1 text-center";
                let content: React.ReactNode = "";

                if (entry) {
                  cellClass += ` ${TYPE_COLORS[entry.type] ?? ""}`;
                  content = (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" title={entry.note ?? entry.type}>
                      {TYPE_LABELS[entry.type] ?? "?"}
                    </span>
                  );
                } else if (isWeekend) {
                  cellClass += " bg-muted/30";
                }

                return (
                  <td key={d.date} className={cellClass} title={entry?.note ?? d.holidayName ?? ""}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

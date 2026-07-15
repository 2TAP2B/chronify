"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { de as deLocale, enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventType } from "@/server/services/calendar";
import { CalendarDayDetail } from "./calendar-day-detail";

const locales = { de: deLocale, en: enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const EVENT_STYLES: Record<CalendarEventType, { bg: string; text: string; border: string }> = {
  WORK: { bg: "bg-blue-100 dark:bg-blue-950", text: "text-blue-800 dark:text-blue-200", border: "border-blue-300 dark:border-blue-800" },
  VACATION: { bg: "bg-emerald-100 dark:bg-emerald-950", text: "text-emerald-800 dark:text-emerald-200", border: "border-emerald-300 dark:border-emerald-800" },
  VACATION_PENDING: { bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-800 dark:text-amber-200", border: "border-amber-300 dark:border-amber-800" },
  SICK: { bg: "bg-red-100 dark:bg-red-950", text: "text-red-800 dark:text-red-200", border: "border-red-300 dark:border-red-800" },
  PUBLIC_HOLIDAY: { bg: "bg-purple-100 dark:bg-purple-950", text: "text-purple-800 dark:text-purple-200", border: "border-purple-300 dark:border-purple-800" },
  CLOSURE: { bg: "bg-orange-100 dark:bg-orange-950", text: "text-orange-800 dark:text-orange-200", border: "border-orange-300 dark:border-orange-800" },
};

function eventStyleGetter(event: CalendarEvent) {
  const style = EVENT_STYLES[event.type];
  return {
    className: cn(style.bg, style.text, "border-l-4", style.border, "rounded px-1 py-0.5 text-xs font-medium"),
  };
}

const LEGEND_ITEMS: { type: CalendarEventType; key: string }[] = [
  { type: "WORK", key: "work" },
  { type: "VACATION", key: "vacation" },
  { type: "VACATION_PENDING", key: "vacationPending" },
  { type: "SICK", key: "sick" },
  { type: "PUBLIC_HOLIDAY", key: "publicHoliday" },
  { type: "CLOSURE", key: "closure" },
];

export function PersonalCalendar({
  events,
  initialDate,
}: {
  events: CalendarEvent[];
  initialDate: Date;
}) {
  const t = useTranslations("calendar");
  const locale = useLocale() as "de" | "en";
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentDate, setCurrentDate] = useState(initialDate);

  const messages = useMemo(
    () => ({
      date: t("title"),
      time: t("time"),
      event: t("event"),
      allDay: t("allDay"),
      week: t("week"),
      work_week: t("workWeek"),
      day: t("day"),
      month: t("month"),
      previous: t("prev"),
      next: t("next"),
      today: t("today"),
      agenda: t("agenda"),
      showMore: (count: number) => `+${count} ${t("more")}`,
    }),
    [t]
  );

  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
    const params = new URLSearchParams(window.location.search);
    params.set("year", String(date.getFullYear()));
    params.set("month", String(date.getMonth() + 1));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(
      (e) => e.start.toDateString() === selectedDate.toDateString()
    );
  }, [events, selectedDate]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-medium text-muted-foreground">{t("legend")}:</span>
        {LEGEND_ITEMS.map((item) => (
          <span key={item.type} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded border", EVENT_STYLES[item.type].bg, EVENT_STYLES[item.type].border)} />
            {t(item.key)}
          </span>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-2">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={[Views.MONTH]}
          defaultView={Views.MONTH}
          culture={locale}
          messages={messages}
          eventPropGetter={eventStyleGetter}
          onNavigate={handleNavigate}
          date={currentDate}
          onSelectEvent={(e) => setSelectedDate((e as CalendarEvent).start)}
          popup
          className="h-[70vh] font-sans text-sm"
        />
      </div>

      <CalendarDayDetail
        date={selectedDate}
        events={selectedEvents}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
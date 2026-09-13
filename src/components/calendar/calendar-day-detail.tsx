"use client";

import { useTranslations, useLocale } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Plane, HeartPulse, CalendarDays, Store, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventType } from "@/server/services/calendar";
import { formatInZone } from "@/lib/datetime";

const TYPE_CONFIG: Record<
  CalendarEventType,
  { icon: LucideIcon; key: string; badgeClass: string }
> = {
  WORK: {
    icon: Clock,
    key: "work",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  },
  VACATION: {
    icon: Plane,
    key: "vacation",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  VACATION_PENDING: {
    icon: Plane,
    key: "vacationPending",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  SICK: {
    icon: HeartPulse,
    key: "sick",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
  PUBLIC_HOLIDAY: {
    icon: CalendarDays,
    key: "publicHoliday",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  },
  CLOSURE: {
    icon: Store,
    key: "closure",
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  },
};

export function CalendarDayDetail({
  date,
  events,
  onClose,
}: {
  date: Date | null;
  events: CalendarEvent[];
  onClose: () => void;
}) {
  const t = useTranslations("calendar");
  const locale = useLocale() as "de" | "en";
  const timeZone = "Europe/Berlin";

  const dateStr = date ? formatInZone(date, timeZone, "EEEE, d. MMMM yyyy", locale) : "";

  return (
    <Dialog
      open={date !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{dateStr}</DialogTitle>
        </DialogHeader>

        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("noEntries")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((e) => {
              const cfg = TYPE_CONFIG[e.type];
              const Icon = cfg.icon;
              return (
                <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      cfg.badgeClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{e.title}</p>
                      <Badge variant="outline" className={cn("text-xs", cfg.badgeClass)}>
                        {t(cfg.key)}
                      </Badge>
                    </div>
                    {e.startAt && e.endAt && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatInZone(new Date(e.startAt), timeZone, "HH:mm", locale)}–
                        {formatInZone(new Date(e.endAt), timeZone, "HH:mm", locale)}
                        {e.breakMinutes ? ` · ${t("break")}: ${e.breakMinutes}min` : ""}
                      </p>
                    )}
                    {e.note && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                        <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                        {e.note}
                      </p>
                    )}
                    {e.vacationStatus && e.vacationStatus !== "APPROVED" && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(e.vacationStatus.toLowerCase() as "pending" | "rejected" | "cancelled")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

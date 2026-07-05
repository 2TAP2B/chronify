"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimeEntryDialog } from "@/components/timesheet/time-entry-dialog";
import { QuickFillDialog } from "@/components/timesheet/quick-fill-dialog";
import { formatDurationShort } from "@/lib/timer-utils";
import { formatInZone } from "@/lib/datetime";

export type GridEntry = {
  id: string;
  date: string;
  startAt: string | null;
  endAt: string | null;
  breakMinutes: number;
  type: string;
  note: string | null;
  source: string;
  locked: boolean;
};

export type GridDay = {
  date: string;
  label: string;
  isToday: boolean;
  entries: GridEntry[];
};

function entryDurationMs(e: GridEntry): number {
  if (!e.startAt || !e.endAt) return 0;
  const gross = new Date(e.endAt).getTime() - new Date(e.startAt).getTime();
  return Math.max(0, gross - e.breakMinutes * 60_000);
}

export function TimesheetGrid({
  days,
  timeZone,
  lockWindowDays,
}: {
  days: GridDay[];
  timeZone: string;
  lockWindowDays: number;
}) {
  const t = useTranslations("timesheet");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GridEntry | null>(null);
  const [addDay, setAddDay] = useState<string | null>(null);
  const [quickFillOpen, setQuickFillOpen] = useState(false);
  const [, startTransition] = useTransition();

  const weekTotalMs = days.reduce(
    (sum, d) => sum + d.entries.reduce((s, e) => s + entryDurationMs(e), 0),
    0
  );

  function openAdd(dayIso: string) {
    setEditing(null);
    setAddDay(dayIso);
    setDialogOpen(true);
  }

  function openEdit(entry: GridEntry) {
    setEditing(entry);
    setAddDay(null);
    setDialogOpen(true);
  }

  async function onDelete(entry: GridEntry) {
    if (!confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await fetch(`/api/time-entries/${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert((b as { error?: string }).error ?? "error");
      }
      window.location.reload();
    });
  }

  const dialogInitial = editing
    ? {
        id: editing.id,
        date: editing.date,
        startAt: editing.startAt,
        endAt: editing.endAt,
        breakMinutes: editing.breakMinutes,
        type: editing.type,
        note: editing.note,
      }
    : {
        date: addDay ?? new Date().toISOString(),
        startAt: null,
        endAt: null,
        breakMinutes: 0,
        type: "WORK",
        note: null,
      };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setQuickFillOpen(true)}>
          <Zap className="mr-1.5 h-4 w-4" />
          {t("quickFill")}
        </Button>
      </div>
      <div className="space-y-3">
        {days.map((day) => {
          const dayTotalMs = day.entries.reduce((s, e) => s + entryDurationMs(e), 0);
          return (
            <div key={day.date} className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">{day.label}</span>
                  {day.isToday && <Badge variant="default">{t("currentWeek")}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm tabular-nums">
                    {formatDurationShort(dayTotalMs)}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => openAdd(day.date)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {day.entries.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">{t("noEntries")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">{t("start")}</TableHead>
                      <TableHead className="w-24">{t("end")}</TableHead>
                      <TableHead className="w-20">{t("break")}</TableHead>
                      <TableHead className="w-24">{t("duration")}</TableHead>
                      <TableHead>{t("note")}</TableHead>
                      <TableHead className="w-24">{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {day.entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono tabular-nums">
                          {e.startAt ? formatInZone(new Date(e.startAt), timeZone, "HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {e.endAt ? formatInZone(new Date(e.endAt), timeZone, "HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {e.breakMinutes} {t("minutes")}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {formatDurationShort(entryDurationMs(e))}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {e.note ?? <span className="text-muted-foreground">—</span>}
                          {e.source === "TIMER" && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">T</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={e.locked}
                              onClick={() => openEdit(e)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={e.locked}
                              onClick={() => onDelete(e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            {e.locked && <Badge variant="secondary">{t("locked")}</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-sm font-medium">{t("weekTotal")}</span>
        <span className="font-mono text-lg font-bold tabular-nums">
          {formatDurationShort(weekTotalMs)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("lockedHint", { days: lockWindowDays })}
      </p>

      {dialogOpen && (
        <TimeEntryDialog
          open={dialogOpen}
          mode={editing ? "edit" : "create"}
          initial={dialogInitial}
          onClose={() => setDialogOpen(false)}
          onSaved={() => window.location.reload()}
        />
      )}

      <QuickFillDialog
        days={days}
        open={quickFillOpen}
        onClose={() => setQuickFillOpen(false)}
        onDone={() => {
          setQuickFillOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}

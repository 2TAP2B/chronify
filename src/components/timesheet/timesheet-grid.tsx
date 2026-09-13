"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Zap, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  adminUserId,
}: {
  days: GridDay[];
  timeZone: string;
  lockWindowDays: number;
  adminUserId?: string;
}) {
  const t = useTranslations("timesheet");
  const confirm = useConfirm();
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
    if (
      !(await confirm({
        title: t("confirmDelete"),
        variant: "destructive",
        confirmLabel: t("delete"),
      }))
    )
      return;
    startTransition(async () => {
      const res = await fetch(
        `/api/time-entries/${entry.id}${adminUserId ? `?userId=${adminUserId}` : ""}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        await confirm({
          title: "Fehler",
          description: (b as { error?: string }).error ?? "error",
          confirmLabel: "OK",
        });
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
          const isWeekend = (() => {
            const dow = new Date(day.date).getUTCDay();
            return dow === 0 || dow === 6;
          })();
          return (
            <div
              key={day.date}
              className={`rounded-lg border shadow-sm overflow-hidden ${
                day.isToday ? "ring-2 ring-primary/50" : ""
              } ${isWeekend && day.entries.length === 0 ? "bg-foreground/[0.03]" : "bg-card"}`}
            >
              <div className="flex items-center justify-between border-b bg-foreground/[0.05] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold capitalize">{day.label}</span>
                  {day.isToday && <Badge variant="default">{t("today")}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {dayTotalMs > 0 && (
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatDurationShort(dayTotalMs)}
                    </span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openAdd(day.date)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {day.entries.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground italic">{t("noEntries")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b bg-foreground/[0.04] hover:bg-foreground/[0.04]">
                      <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wide">
                        {t("start")}
                      </TableHead>
                      <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wide">
                        {t("end")}
                      </TableHead>
                      <TableHead className="w-[16%] text-xs font-semibold uppercase tracking-wide">
                        {t("break")}
                      </TableHead>
                      <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wide">
                        {t("duration")}
                      </TableHead>
                      <TableHead className="hidden md:table-cell text-xs font-semibold uppercase tracking-wide">
                        {t("note")}
                      </TableHead>
                      <TableHead className="w-[60px] text-xs font-semibold uppercase tracking-wide">
                        {t("actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {day.entries.map((e) => (
                      <TableRow key={e.id} className="hover:bg-accent/50">
                        <TableCell className="font-mono text-sm tabular-nums font-medium">
                          {e.startAt ? formatInZone(new Date(e.startAt), timeZone, "HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm tabular-nums font-medium">
                          {e.endAt ? formatInZone(new Date(e.endAt), timeZone, "HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                          {e.breakMinutes} <span className="hidden md:inline">{t("minutes")}</span>
                        </TableCell>
                        <TableCell className="font-mono text-sm tabular-nums font-semibold">
                          {formatDurationShort(entryDurationMs(e))}
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px] truncate text-sm">
                          {e.note ?? <span className="text-muted-foreground">—</span>}
                          {e.source === "TIMER" && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              T
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-3">
                          {e.locked ? (
                            <Badge variant="secondary">{t("locked")}</Badge>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(e)}>
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  {t("edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => onDelete(e)}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  {t("delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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

      <div className="flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-3 shadow-sm">
        <span className="text-sm font-semibold">{t("weekTotal")}</span>
        <span className="font-mono text-xl font-bold tabular-nums">
          {formatDurationShort(weekTotalMs)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t("lockedHint", { days: lockWindowDays })}</p>

      {dialogOpen && (
        <TimeEntryDialog
          open={dialogOpen}
          mode={editing ? "edit" : "create"}
          initial={dialogInitial}
          adminUserId={adminUserId}
          onClose={() => setDialogOpen(false)}
          onSaved={() => window.location.reload()}
        />
      )}

      <QuickFillDialog
        days={days}
        timeZone={timeZone}
        adminUserId={adminUserId}
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

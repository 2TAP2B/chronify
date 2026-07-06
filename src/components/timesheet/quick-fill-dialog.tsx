"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { GridDay } from "@/components/timesheet/timesheet-grid";

function combine(dateStr: string, timeStr: string): string | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const asZone = new Date(y, mo - 1, d, h, m, 0);
  const asUtc = Date.UTC(y, mo - 1, d, h, m, 0);
  const offset = asZone.getTime() - asUtc;
  return new Date(asUtc - offset).toISOString();
}

function dateToISOInput(iso: string): string {
  return iso.slice(0, 10);
}

function getWeekday(iso: string): number {
  return new Date(iso).getUTCDay();
}

export function QuickFillDialog({
  days,
  timeZone,
  adminUserId,
  open,
  onClose,
  onDone,
}: {
  days: GridDay[];
  timeZone?: string;
  adminUserId?: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("timesheet");
  const [startAt, setStartAt] = useState("08:00");
  const [endAt, setEndAt] = useState("16:00");
  const [breakMinutes, setBreakMinutes] = useState("30");
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const emptyDays = days.filter(
    (d) => d.entries.length === 0 && (!weekdaysOnly || (getWeekday(d.date) >= 1 && getWeekday(d.date) <= 5))
  );

  async function onApply() {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      let created = 0;
      let skipped = 0;
      for (const day of emptyDays) {
        const dateStr = dateToISOInput(day.date);
        const startIso = combine(dateStr, startAt);
        const endIso = combine(dateStr, endAt);
        if (!startIso || !endIso) {
          skipped++;
          continue;
        }
        const qs = adminUserId ? `?userId=${adminUserId}` : "";
        const res = await fetch(`/api/time-entries${qs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: new Date(dateStr + "T00:00:00Z").toISOString(),
            startAt: startIso,
            endAt: endIso,
            breakMinutes: Number(breakMinutes) || 0,
            type: "WORK",
            note: null,
          }),
        });
        if (res.ok) created++;
        else skipped++;
      }
      setResult(t("quickFillResult", { created, skipped }));
      if (created > 0) {
        onDone();
      }
    } catch {
      setError("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("quickFillTitle")}</DialogTitle>
          <DialogDescription>{t("quickFillDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qf-start">{t("start")}</Label>
              <Input
                id="qf-start"
                type="text"
                inputMode="numeric"
                placeholder="08:00"
                maxLength={5}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qf-end">{t("end")}</Label>
              <Input
                id="qf-end"
                type="text"
                inputMode="numeric"
                placeholder="16:00"
                maxLength={5}
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qf-break">{t("break")} ({t("minutes")})</Label>
              <Input
                id="qf-break"
                type="number"
                min={0}
                max={1440}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="qf-weekdays"
              checked={weekdaysOnly}
              onCheckedChange={(v) => setWeekdaysOnly(v === true)}
            />
            <Label htmlFor="qf-weekdays" className="cursor-pointer text-sm">
              {t("weekdaysOnly")}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("quickFillCount", { count: emptyDays.length })}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && <p className="text-sm text-emerald-600">{result}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={onApply} disabled={saving || emptyDays.length === 0}>
            {saving ? "…" : t("quickFillApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EntryFormData = {
  date: string; // yyyy-mm-dd
  startAt: string; // HH:mm
  endAt: string; // HH:mm
  breakMinutes: number;
  type: string;
  note: string;
};

export type EntryFormMode = "create" | "edit";

function isoToTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toLocalDateInput(dateIso: string): string {
  return dateIso.slice(0, 10);
}

function combine(dateStr: string, timeStr: string): string | null {
  if (!timeStr) return null;
  // Treat as Europe/Berlin local time → store as UTC instant.
  // Simple approach: build an ISO with tz offset (CET/CEST varies; use Intl to get offset).
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const asZone = new Date(y, mo - 1, d, h, m, 0);
  const asUtc = Date.UTC(y, mo - 1, d, h, m, 0);
  const offset = asZone.getTime() - asUtc;
  return new Date(asUtc - offset).toISOString();
}

export function TimeEntryDialog({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: EntryFormMode;
  initial: {
    id?: string;
    date: string; // iso
    startAt: string | null; // iso
    endAt: string | null; // iso
    breakMinutes: number;
    type: string;
    note: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("timesheet");
  const [date, setDate] = useState(toLocalDateInput(initial.date));
  const [startAt, setStartAt] = useState(isoToTimeInput(initial.startAt));
  const [endAt, setEndAt] = useState(isoToTimeInput(initial.endAt));
  const [breakMinutes, setBreakMinutes] = useState(String(initial.breakMinutes ?? 0));
  const [type, setType] = useState(initial.type || "WORK");
  const [note, setNote] = useState(initial.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const startIso = combine(date, startAt);
      const endIso = combine(date, endAt);
      const body = {
        date: new Date(date + "T00:00:00Z").toISOString(),
        startAt: startIso,
        endAt: endIso,
        breakMinutes: Number(breakMinutes) || 0,
        type,
        note: note || null,
      };
      const url = mode === "edit" ? `/api/time-entries/${initial.id}` : "/api/time-entries";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? t("edit") : t("add")}
          </DialogTitle>
          <DialogDescription>{date}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">{t("day")}</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">{t("type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WORK">{t("types.WORK")}</SelectItem>
                  <SelectItem value="VACATION">{t("types.VACATION")}</SelectItem>
                  <SelectItem value="SICK">{t("types.SICK")}</SelectItem>
                  <SelectItem value="PUBLIC_HOLIDAY">{t("types.PUBLIC_HOLIDAY")}</SelectItem>
                  <SelectItem value="PERSONAL">{t("types.PERSONAL")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start">{t("start")}</Label>
              <Input
                id="start"
                type="time"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">{t("end")}</Label>
              <Input
                id="end"
                type="time"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="break">{t("break")} ({t("minutes")})</Label>
              <Input
                id="break"
                type="number"
                min={0}
                max={1440}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">{t("note")}</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

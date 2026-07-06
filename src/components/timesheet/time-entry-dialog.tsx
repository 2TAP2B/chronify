"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { ChevronUp, ChevronDown } from "lucide-react";
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
import { TimeInput } from "@/components/timesheet/time-input";
import { DatePicker } from "@/components/ui/date-picker";

export type EntryFormData = {
  date: string;
  startAt: string;
  endAt: string;
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
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const asZone = new Date(y, mo - 1, d, h, m, 0);
  const asUtc = Date.UTC(y, mo - 1, d, h, m, 0);
  const offset = asZone.getTime() - asUtc;
  return new Date(asUtc - offset).toISOString();
}

const MAX_DURATION_MIN = 1440;
const STEP_MIN = 15;
const DEFAULT_START = "08:00";
const DEFAULT_END = "16:00";
const DEFAULT_BREAK = "30";

function snapToStep(min: number): number {
  return Math.max(0, Math.min(MAX_DURATION_MIN, Math.round(min / STEP_MIN) * STEP_MIN));
}

function parseHHMM(s: string): number | null {
  const clean = s.replace(/[^\d:]/g, "");
  const m = clean.match(/^(\d{1,2}):?(\d{0,2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function formatHHMM(totalMin: number | null): string {
  if (totalMin == null) return "";
  const clamped = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDuration(totalMin: number): string {
  if (totalMin <= 0) return "00:00";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseDuration(s: string): number | null {
  const clean = s.replace(/[^\d:.,]/g, "");
  if (clean.includes(":")) {
    const [h, m] = clean.split(":").map(Number);
    if (Number.isNaN(h)) return null;
    return h * 60 + (m || 0);
  }
  if (clean.includes(",") || clean.includes(".")) {
    const decimal = parseFloat(clean.replace(",", "."));
    if (Number.isNaN(decimal)) return null;
    return Math.round(decimal * 60);
  }
  const h = parseInt(clean, 10);
  if (Number.isNaN(h)) return null;
  return h * 60;
}

function autoFormatDuration(s: string): string {
  if (s.includes(":")) return s;
  const digits = s.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
}

export function TimeEntryDialog({
  open,
  mode,
  initial,
  adminUserId,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: EntryFormMode;
  initial: {
    id?: string;
    date: string;
    startAt: string | null;
    endAt: string | null;
    breakMinutes: number;
    type: string;
    note: string | null;
  };
  adminUserId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("timesheet");
  const isCreate = mode === "create";
  const initStart = initial.startAt ? isoToTimeInput(initial.startAt) : (isCreate ? DEFAULT_START : "");
  const initEnd = initial.endAt ? isoToTimeInput(initial.endAt) : (isCreate ? DEFAULT_END : "");
  const initBreak = initial.breakMinutes != null ? String(initial.breakMinutes) : (isCreate ? DEFAULT_BREAK : "0");

  const [date, setDate] = useState(toLocalDateInput(initial.date));
  const [startAt, setStartAt] = useState(initStart);
  const [endAt, setEndAt] = useState(initEnd);
  const [durationInput, setDurationInput] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(initBreak);
  const [type, setType] = useState(initial.type || "WORK");
  const [note, setNote] = useState(initial.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMin = useMemo(() => parseHHMM(startAt), [startAt]);
  const endMin = useMemo(() => parseHHMM(endAt), [endAt]);

  const computedDuration = useMemo(() => {
    if (startMin == null || endMin == null) return null;
    return endMin - startMin;
  }, [startMin, endMin]);

  const displayedDuration = useMemo(() => {
    if (durationInput) {
      const parsed = parseDuration(durationInput);
      return parsed;
    }
    return computedDuration;
  }, [durationInput, computedDuration]);

  const onStartTimeChange = useCallback((v: string) => {
    setStartAt(v);
    setDurationInput("");
  }, []);

  const onEndTimeChange = useCallback((v: string) => {
    setEndAt(v);
    setDurationInput("");
  }, []);

  const onDurationChange = useCallback((raw: string) => {
    const formatted = raw.includes(":") || raw.includes(",") || raw.includes(".")
      ? raw
      : autoFormatDuration(raw);
    setDurationInput(formatted);
    const parsed = parseDuration(formatted);
    if (parsed != null && startMin != null) {
      const snapped = snapToStep(parsed);
      const newEnd = startMin + snapped;
      setEndAt(formatHHMM(newEnd));
    }
  }, [startMin]);

  const stepDuration = useCallback((delta: number) => {
    const current = durationInput ? parseDuration(durationInput) : computedDuration;
    if (current == null) return;
    const next = snapToStep(current + delta);
    setDurationInput(formatDuration(next));
    if (startMin != null) {
      setEndAt(formatHHMM(startMin + next));
    }
  }, [durationInput, computedDuration, startMin]);

  const onDurationKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      stepDuration(STEP_MIN);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      stepDuration(-STEP_MIN);
    }
  }, [stepDuration]);

  const durationDisplay = useMemo(() => {
    if (displayedDuration == null) return durationInput;
    return formatDuration(displayedDuration);
  }, [displayedDuration, durationInput]);

  const netDuration = useMemo(() => {
    if (computedDuration == null) return null;
    return Math.max(0, computedDuration - (Number(breakMinutes) || 0));
  }, [computedDuration, breakMinutes]);

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
      const qs = adminUserId ? `?userId=${adminUserId}` : "";
      const url = mode === "edit" ? `/api/time-entries/${initial.id}${qs}` : `/api/time-entries${qs}`;
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
              <DatePicker
                value={date ? new Date(date + "T00:00:00") : undefined}
                onChange={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
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
              <TimeInput
                placeholder="08:00"
                value={startAt}
                onChange={onStartTimeChange}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">{t("end")}</Label>
              <TimeInput
                placeholder="16:00"
                value={endAt}
                onChange={onEndTimeChange}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duration">{t("duration")}</Label>
              <div className="relative">
                <Input
                  id="duration"
                  type="text"
                  inputMode="numeric"
                  placeholder="08:00"
                  value={durationDisplay}
                  onChange={(e) => onDurationChange(e.target.value)}
                  onKeyDown={onDurationKeyDown}
                  className="font-mono tabular-nums pr-9"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
                  <button
                    type="button"
                    onClick={() => stepDuration(STEP_MIN)}
                    className="text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepDuration(-STEP_MIN)}
                    className="text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {netDuration != null && netDuration > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("netDuration")}: {formatDuration(netDuration)}
                </p>
              )}
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
            <div className="col-span-2 space-y-1.5">
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

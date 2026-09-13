"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";

type Props = {
  overtimeHours?: number;
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function VacationRequestForm({ overtimeHours = 0 }: Props) {
  const t = useTranslations("vacation");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [useOvertime, setUseOvertime] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const overtimeAvailable = overtimeHours > 0;

  const handleFromChange = useCallback((value: string) => {
    setFrom(value);
    setTo(value);
  }, []);

  function setToday() {
    const today = todayISO();
    setFrom(today);
    setTo(today);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/vacation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: new Date(from + "T00:00:00Z").toISOString(),
          to: new Date(to + "T00:00:00Z").toISOString(),
          note: note || null,
          useOvertime,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        const code = (b as { code?: string }).code;
        if (code === "OVERLAP") setError(t("overlapError"));
        else if (code === "INSUFFICIENT_ENTITLEMENT") setError(t("insufficientError"));
        else if (code === "INSUFFICIENT_OVERTIME") setError(t("insufficientOvertimeError"));
        else if (code === "NO_BUSINESS_DAYS") setError(t("noBusinessDaysError"));
        else setError((b as { error?: string }).error ?? "error");
        return;
      }
      setSuccess(true);
      setFrom("");
      setTo("");
      setNote("");
      setUseOvertime(false);
      window.location.reload();
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="from">{t("from")}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={setToday}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              {t("today")}
            </Button>
          </div>
          <DatePicker
            id="from"
            value={from ? new Date(from + "T00:00:00") : undefined}
            onChange={(d) => d && handleFromChange(format(d, "yyyy-MM-dd"))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">{t("to")}</Label>
          <DatePicker
            id="to"
            value={to ? new Date(to + "T00:00:00") : undefined}
            onChange={(d) => d && setTo(format(d, "yyyy-MM-dd"))}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">{t("note")}</Label>
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="useOvertime"
          checked={useOvertime}
          onCheckedChange={(v) => setUseOvertime(v === true)}
          disabled={!overtimeAvailable}
        />
        <div className="grid gap-0.5 leading-none">
          <Label
            htmlFor="useOvertime"
            className={overtimeAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}
          >
            {t("useOvertimeLabel")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {overtimeAvailable
              ? t("overtimeAvailable", { hours: overtimeHours })
              : t("noOvertimeAvailable")}
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-600">✓</p>}
      <Button type="submit" disabled={loading}>
        {t("submit")}
      </Button>
    </form>
  );
}

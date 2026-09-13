"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function minutesToHours(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hoursToMinutes(s: string): number {
  const clean = s.replace(/[^\d:.-]/g, "");
  if (clean.includes(":")) {
    const [h, m] = clean.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  const decimal = parseFloat(clean.replace(",", "."));
  if (Number.isNaN(decimal)) return 0;
  return Math.round(decimal * 60);
}

export function OvertimeAdjustDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("adminUsers");
  const year = new Date().getUTCFullYear();
  const [carriedOver, setCarriedOver] = useState("00:00");
  const [consumed, setConsumed] = useState("00:00");
  const [computed, setComputed] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetch(`/api/overtime?userId=${userId}&year=${year}`)
        .then((r) => r.json())
        .then((d) => {
          const comp = d.computation;
          if (comp) {
            setCarriedOver(minutesToHours(comp.carriedOverMinutes ?? 0));
            setConsumed(minutesToHours(comp.consumedOvertimeMinutes ?? 0));
            setComputed(comp.totalDeltaMs != null ? Math.round(comp.totalDeltaMs / 60_000) : null);
          }
        })
        .catch(() => {});
    }
  }, [open, userId, year]);

  const netMinutes = (computed ?? 0) + hoursToMinutes(carriedOver) - hoursToMinutes(consumed);

  async function onSave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust-overtime",
          year,
          carriedOverMinutes: hoursToMinutes(carriedOver),
          consumedOvertimeMinutes: hoursToMinutes(consumed),
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "error");
        return;
      }
      onOpenChange(false);
      window.location.reload();
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("adjustOvertime")} – {userName}
          </DialogTitle>
          <DialogDescription>{t("overtimeHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="carried-over">{t("carriedOverLabel")}</Label>
              <Input
                id="carried-over"
                type="text"
                value={carriedOver}
                onChange={(e) => setCarriedOver(e.target.value)}
                placeholder="00:00"
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consumed">{t("consumedLabel")}</Label>
              <Input
                id="consumed"
                type="text"
                value={consumed}
                onChange={(e) => setConsumed(e.target.value)}
                placeholder="00:00"
                className="font-mono tabular-nums"
              />
            </div>
          </div>
          {computed != null && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t("computedThisYear")}: </span>
              <span className="font-mono font-semibold tabular-nums">
                {minutesToHours(computed)}
              </span>
              <span className="text-muted-foreground"> · {t("netBalance")}: </span>
              <span
                className={`font-mono font-bold tabular-nums ${netMinutes >= 0 ? "text-emerald-600" : "text-destructive"}`}
              >
                {minutesToHours(netMinutes)}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("overtimeHint")}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button onClick={onSave} disabled={loading}>
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

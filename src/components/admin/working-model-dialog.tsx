"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Plus } from "lucide-react";
import type { WorkingModel } from "@prisma/client";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export function WorkingModelDialog({
  mode,
  userId,
  model,
}: {
  mode: "create" | "edit";
  userId: string;
  model?: WorkingModel;
}) {
  const t = useTranslations("adminWorkingModels");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [validFrom, setValidFrom] = useState(
    model ? new Date(model.validFrom).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [validTo, setValidTo] = useState(
    model?.validTo ? new Date(model.validTo).toISOString().slice(0, 10) : ""
  );
  const [dayHours, setDayHours] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const d of DAYS) {
      const mins = Number(model?.[`${d}Minutes` as keyof WorkingModel] ?? 0);
      init[d] = (mins / 60).toString();
    }
    return init;
  });
  const [weeklyTargetHours, setWeeklyTargetHours] = useState(
    ((model?.weeklyTargetMinutes ?? 0) / 60).toString()
  );
  const [ab6, setAb6] = useState(String(model?.autoBreakMinutes6h ?? 30));
  const [ab9, setAb9] = useState(String(model?.autoBreakMinutes9h ?? 45));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        userId,
        validFrom: new Date(validFrom + "T00:00:00Z").toISOString(),
        validTo: validTo ? new Date(validTo + "T00:00:00Z").toISOString() : null,
        weeklyTargetMinutes: Math.round((parseFloat(weeklyTargetHours) || 0) * 60),
        autoBreakMinutes6h: Number(ab6) || 0,
        autoBreakMinutes9h: Number(ab9) || 0,
        autoBreakThreshold6h: true,
        autoBreakThreshold9h: true,
      };
      for (const d of DAYS) {
        const hours = parseFloat(dayHours[d]) || 0;
        body[`${d}Minutes`] = Math.round(hours * 60);
      }
      const url = mode === "edit" ? `/api/admin/working-models/${model!.id}` : "/api/admin/working-models";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "error");
        return;
      }
      setOpen(false);
      window.location.reload();
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={mode === "create" ? "default" : "ghost"}>
          {mode === "create" ? <Plus className="mr-1 h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
          {mode === "create" ? t("add") : t("edit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("add") : t("edit")}</DialogTitle>
          <DialogDescription>{userId}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="validFrom">{t("validFrom")}</Label>
              <Input id="validFrom" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="validTo">{t("validTo")}</Label>
              <Input id="validTo" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {DAYS.map((d) => (
              <div key={d} className="space-y-1.5">
                <Label htmlFor={d}>{t(d as never)} (h)</Label>
                <Input
                  id={d}
                  type="number"
                  min={0}
                  max={24}
                  step={0.25}
                  value={dayHours[d]}
                  onChange={(e) => setDayHours({ ...dayHours, [d]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="weeklyTarget">{t("weeklyTarget")} (h)</Label>
              <Input id="weeklyTarget" type="number" min={0} max={168} step={0.25} value={weeklyTargetHours} onChange={(e) => setWeeklyTargetHours(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab6">{t("autoBreak6hMin")}</Label>
              <Input id="ab6" type="number" min={0} value={ab6} onChange={(e) => setAb6(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab9">{t("autoBreak9hMin")}</Label>
              <Input id="ab9" type="number" min={0} value={ab9} onChange={(e) => setAb9(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>{t("cancel")}</Button>
            <Button type="submit" disabled={loading}>{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import type { WorkingModelTemplate } from "@prisma/client";

const DAYS = [
  { key: "mondayMinutes" as const, label: "Mo" },
  { key: "tuesdayMinutes" as const, label: "Di" },
  { key: "wednesdayMinutes" as const, label: "Mi" },
  { key: "thursdayMinutes" as const, label: "Do" },
  { key: "fridayMinutes" as const, label: "Fr" },
  { key: "saturdayMinutes" as const, label: "Sa" },
  { key: "sundayMinutes" as const, label: "So" },
];

export function TemplateDialog({ mode, template }: { mode: "create" | "edit"; template?: WorkingModelTemplate }) {
  const t = useTranslations("adminWorkingModels");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(template?.name ?? "");
  const [dayHours, setDayHours] = useState<Record<string, string>>(
    DAYS.reduce((acc, d) => {
      const mins = template?.[d.key] ?? 0;
      acc[d.key] = (mins / 60).toString();
      return acc;
    }, {} as Record<string, string>)
  );
  const [weeklyTargetHours, setWeeklyTargetHours] = useState(
    ((template?.weeklyTargetMinutes ?? 0) / 60).toString()
  );
  const [ab6, setAb6] = useState(template?.autoBreakMinutes6h ?? 30);
  const [ab9, setAb9] = useState(template?.autoBreakMinutes9h ?? 45);
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const dayMinutes: Record<string, number> = {};
    for (const d of DAYS) {
      const hours = parseFloat(dayHours[d.key] ?? "0");
      dayMinutes[d.key] = Math.round((isNaN(hours) ? 0 : hours) * 60);
    }
    const wtHours = parseFloat(weeklyTargetHours ?? "0");
    const body = {
      name,
      ...dayMinutes,
      weeklyTargetMinutes: Math.round((isNaN(wtHours) ? 0 : wtHours) * 60),
      autoBreakMinutes6h: Number(ab6),
      autoBreakMinutes9h: Number(ab9),
      autoBreakThreshold6h: true,
      autoBreakThreshold9h: true,
      isDefault,
    };
    try {
      const url = mode === "create" ? "/api/admin/working-model-templates" : `/api/admin/working-model-templates/${template!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        if ((b as { code?: string }).code === "NAME_TAKEN") setError(t("nameTaken"));
        else setError((b as { error?: string }).error ?? "error");
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
          {mode === "create" ? t("newTemplate") : t("edit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("newTemplate") : t("edit")}</DialogTitle>
          <DialogDescription>{template?.name ?? ""}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">{t("templateName")}</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((d) => (
              <div key={d.key} className="space-y-1">
                <Label htmlFor={d.key} className="text-xs">{d.label} (h)</Label>
                <Input
                  id={d.key}
                  type="number"
                  min={0}
                  max={24}
                  step={0.25}
                  value={dayHours[d.key]}
                  onChange={(e) => setDayHours({ ...dayHours, [d.key]: e.target.value })}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="weekly-target">{t("weeklyTarget")} (h)</Label>
              <Input id="weekly-target" type="number" min={0} max={168} step={0.25} value={weeklyTargetHours} onChange={(e) => setWeeklyTargetHours(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab6">Auto-Pause 6h (Min.)</Label>
              <Input id="ab6" type="number" min={0} max={480} value={ab6} onChange={(e) => setAb6(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ab9">Auto-Pause 9h (Min.)</Label>
              <Input id="ab9" type="number" min={0} max={480} value={ab9} onChange={(e) => setAb9(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="is-default" checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} />
            <Label htmlFor="is-default">{t("setDefault")}</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>{t("cancel")}</Button>
            <Button type="submit" disabled={loading}>{t("save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

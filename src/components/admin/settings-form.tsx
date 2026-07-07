"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrgSettings } from "@prisma/client";

const STATE_NAMES: Record<string, string> = {
  DE_BW: "Baden-Württemberg",
  DE_BY: "Bayern",
  DE_BE: "Berlin",
  DE_BB: "Brandenburg",
  DE_HB: "Bremen",
  DE_HE: "Hessen",
  DE_HH: "Hamburg",
  DE_ME: "Mecklenburg-Vorpommern",
  DE_MV: "Mecklenburg-Vorpommern",
  DE_NI: "Niedersachsen",
  DE_NW: "Nordrhein-Westfalen",
  DE_RP: "Rheinland-Pfalz",
  DE_SL: "Saarland",
  DE_SN: "Sachsen",
  DE_ST: "Sachsen-Anhalt",
  DE_SH: "Schleswig-Holstein",
  DE_TH: "Thüringen",
};

const STATES = Object.keys(STATE_NAMES);

export function SettingsForm({ settings }: { settings: OrgSettings }) {
  const t = useTranslations("adminSettings");
  const [form, setForm] = useState({
    defaultFederalState: settings.defaultFederalState,
    overtimeCarryoverCutoffMonth: settings.overtimeCarryoverCutoffMonth,
    overtimeCarryoverCutoffDay: settings.overtimeCarryoverCutoffDay,
    overtimeCarryoverCutoffEnabled: settings.overtimeCarryoverCutoffEnabled,
    timeEntryLockWindowDays: String(settings.timeEntryLockWindowDays),
    autoBreakDefault: settings.autoBreakDefault,
    defaultVacationDays: String(settings.defaultVacationDays),
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cutoffDate = new Date(2026, form.overtimeCarryoverCutoffMonth - 1, form.overtimeCarryoverCutoffDay);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultFederalState: form.defaultFederalState,
          overtimeCarryoverCutoffMonth: form.overtimeCarryoverCutoffEnabled ? form.overtimeCarryoverCutoffMonth : null,
          overtimeCarryoverCutoffDay: form.overtimeCarryoverCutoffEnabled ? form.overtimeCarryoverCutoffDay : null,
          overtimeCarryoverCutoffEnabled: form.overtimeCarryoverCutoffEnabled,
          timeEntryLockWindowDays: Number(form.timeEntryLockWindowDays),
          autoBreakDefault: form.autoBreakDefault,
          defaultVacationDays: Number(form.defaultVacationDays),
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "error");
        return;
      }
      setMsg(t("saved"));
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fs">{t("defaultFederalState")}</Label>
          <Select value={form.defaultFederalState} onValueChange={(v) => setForm({ ...form, defaultFederalState: v as never })}>
            <SelectTrigger id="fs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATES.map((s) => <SelectItem key={s} value={s}>{STATE_NAMES[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lw">{t("lockWindowDays")}</Label>
          <Input id="lw" type="number" min={0} max={365} value={form.timeEntryLockWindowDays} onChange={(e) => setForm({ ...form, timeEntryLockWindowDays: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vd">{t("defaultVacationDays")}</Label>
          <Input id="vd" type="number" min={0} max={60} step="0.5" value={form.defaultVacationDays} onChange={(e) => setForm({ ...form, defaultVacationDays: e.target.value })} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="ab">{t("autoBreakLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("autoBreakHint")}</p>
        </div>
        <Switch
          id="ab"
          checked={form.autoBreakDefault === "AUTO"}
          onCheckedChange={(checked) => setForm({ ...form, autoBreakDefault: checked ? "AUTO" : "MANUAL" })}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label>{t("carryoverEnabled")}</Label>
          <p className="text-xs text-muted-foreground">{t("carryoverEnabledHint")}</p>
        </div>
        <Switch
          checked={form.overtimeCarryoverCutoffEnabled}
          onCheckedChange={(checked) => setForm({ ...form, overtimeCarryoverCutoffEnabled: checked })}
        />
      </div>

      {form.overtimeCarryoverCutoffEnabled && (
        <div className="space-y-1.5">
          <Label>{t("carryoverCutoffDate")}</Label>
          <DatePicker
            value={cutoffDate}
            onChange={(d) => {
              if (d) {
                setForm({
                  ...form,
                  overtimeCarryoverCutoffMonth: d.getMonth() + 1,
                  overtimeCarryoverCutoffDay: d.getDate(),
                });
              }
            }}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <Button type="submit" disabled={loading}>{t("save")}</Button>
    </form>
  );
}
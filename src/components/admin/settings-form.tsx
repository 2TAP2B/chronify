"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import type { OrgSettings } from "@prisma/client";

const STATES = [
  "DE_BW", "DE_BY", "DE_BE", "DE_BB", "DE_HB", "DE_HE", "DE_HH", "DE_ME",
  "DE_MV", "DE_NI", "DE_NW", "DE_RP", "DE_SL", "DE_SN", "DE_ST", "DE_SH", "DE_TH",
];

export function SettingsForm({ settings }: { settings: OrgSettings }) {
  const t = useTranslations("adminSettings");
  const [form, setForm] = useState({
    defaultFederalState: settings.defaultFederalState,
    overtimeCarryoverCutoffMonth: String(settings.overtimeCarryoverCutoffMonth),
    overtimeCarryoverCutoffDay: String(settings.overtimeCarryoverCutoffDay),
    timeEntryLockWindowDays: String(settings.timeEntryLockWindowDays),
    autoBreakDefault: settings.autoBreakDefault,
    defaultVacationDays: String(settings.defaultVacationDays),
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          overtimeCarryoverCutoffMonth: Number(form.overtimeCarryoverCutoffMonth),
          overtimeCarryoverCutoffDay: Number(form.overtimeCarryoverCutoffDay),
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
              {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ab">{t("autoBreakDefault")}</Label>
          <Select value={form.autoBreakDefault} onValueChange={(v) => setForm({ ...form, autoBreakDefault: v as never })}>
            <SelectTrigger id="ab"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AUTO">AUTO</SelectItem>
              <SelectItem value="MANUAL">MANUAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cm">{t("carryoverCutoffMonth")}</Label>
          <Input id="cm" type="number" min={1} max={12} value={form.overtimeCarryoverCutoffMonth} onChange={(e) => setForm({ ...form, overtimeCarryoverCutoffMonth: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cd">{t("carryoverCutoffDay")}</Label>
          <Input id="cd" type="number" min={1} max={31} value={form.overtimeCarryoverCutoffDay} onChange={(e) => setForm({ ...form, overtimeCarryoverCutoffDay: e.target.value })} />
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <Button type="submit" disabled={loading}>{t("save")}</Button>
    </form>
  );
}

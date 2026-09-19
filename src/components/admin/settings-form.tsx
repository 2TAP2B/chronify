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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SettingsView } from "@/server/services/admin-settings";
import { STATE_NAMES, STATE_CODES } from "@/lib/federal-states";

export function SettingsForm({ settings }: { settings: SettingsView }) {
  const t = useTranslations("adminSettings");
  const [form, setForm] = useState({
    defaultFederalState: settings.defaultFederalState,
    overtimeCarryoverCutoffMonth: settings.overtimeCarryoverCutoffMonth,
    overtimeCarryoverCutoffDay: settings.overtimeCarryoverCutoffDay,
    overtimeCarryoverCutoffEnabled: settings.overtimeCarryoverCutoffEnabled,
    timeEntryLockWindowDays: String(settings.timeEntryLockWindowDays),
    autoBreakDefault: settings.autoBreakDefault,
    defaultVacationDays: String(settings.defaultVacationDays),
    passwordLoginDisabled: settings.passwordLoginDisabled,
    smtpHost: settings.smtpHost ?? "",
    smtpPort: settings.smtpPort != null ? String(settings.smtpPort) : "",
    smtpUser: settings.smtpUser ?? "",
    smtpPassword: "",
    smtpFrom: settings.smtpFrom ?? "",
    smtpTls: settings.smtpTls !== false,
    smtpSource: settings.smtpSource,
    smtpHasPassword: settings.smtpHasPassword,
  });
  const [loading, setLoading] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cutoffDate = new Date(
    2026,
    form.overtimeCarryoverCutoffMonth - 1,
    form.overtimeCarryoverCutoffDay
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        defaultFederalState: form.defaultFederalState,
        overtimeCarryoverCutoffEnabled: form.overtimeCarryoverCutoffEnabled,
        timeEntryLockWindowDays: Number(form.timeEntryLockWindowDays),
        autoBreakDefault: form.autoBreakDefault,
        defaultVacationDays: Number(form.defaultVacationDays),
        passwordLoginDisabled: form.passwordLoginDisabled,
        ...(form.smtpSource !== "env" && {
          smtpHost: form.smtpHost || null,
          smtpPort: form.smtpPort ? Number(form.smtpPort) : null,
          smtpUser: form.smtpUser || null,
          smtpPassword: form.smtpPassword || null,
          smtpFrom: form.smtpFrom || null,
          smtpTls: form.smtpTls,
        }),
      };
      if (form.overtimeCarryoverCutoffEnabled) {
        body.overtimeCarryoverCutoffMonth = form.overtimeCarryoverCutoffMonth;
        body.overtimeCarryoverCutoffDay = form.overtimeCarryoverCutoffDay;
      }
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Section: Login */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sectionLogin")}</CardTitle>
          <CardDescription>{t("sectionLoginHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="pwLogin">{t("passwordLoginDisabled")}</Label>
              <p className="text-xs text-muted-foreground">{t("passwordLoginDisabledHint")}</p>
            </div>
            <Switch
              id="pwLogin"
              checked={form.passwordLoginDisabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, passwordLoginDisabled: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section: SMTP */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sectionSmtp")}</CardTitle>
          <CardDescription>
            {form.smtpSource === "env" ? t("smtpEnvHint") : t("smtpHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="smtpHost">{t("smtpHost")}</Label>
              <Input
                id="smtpHost"
                value={form.smtpHost}
                disabled={form.smtpSource === "env"}
                onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtpPort">{t("smtpPort")}</Label>
              <Input
                id="smtpPort"
                type="number"
                value={form.smtpPort}
                disabled={form.smtpSource === "env"}
                onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtpUser">{t("smtpUser")}</Label>
              <Input
                id="smtpUser"
                value={form.smtpUser}
                disabled={form.smtpSource === "env"}
                onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtpPassword">{t("smtpPassword")}</Label>
              <Input
                id="smtpPassword"
                type="password"
                value={form.smtpPassword}
                disabled={form.smtpSource === "env"}
                placeholder={form.smtpHasPassword ? t("smtpPasswordMasked") : ""}
                onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtpFrom">{t("smtpFrom")}</Label>
              <Input
                id="smtpFrom"
                value={form.smtpFrom}
                disabled={form.smtpSource === "env"}
                onChange={(e) => setForm((f) => ({ ...f, smtpFrom: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2 py-2">
              <Switch
                id="smtpTls"
                checked={form.smtpTls}
                disabled={form.smtpSource === "env"}
                onCheckedChange={(v) => setForm((f) => ({ ...f, smtpTls: v }))}
              />
              <Label htmlFor="smtpTls">{t("smtpTls")}</Label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={testingSmtp}
              onClick={async () => {
                setTestingSmtp(true);
                setMsg(null);
                setError(null);
                try {
                  const res = await fetch("/api/admin/settings/test-smtp", { method: "POST" });
                  const b = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    message?: string;
                  };
                  if (!res.ok) throw new Error(b.error ?? `HTTP ${res.status}`);
                  setMsg(b.message ?? t("smtpTestSent"));
                } catch (e) {
                  setError(e instanceof Error ? e.message : "error");
                } finally {
                  setTestingSmtp(false);
                }
              }}
            >
              {testingSmtp ? t("smtpTesting") : t("smtpTestButton")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("smtpTestHint")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Section: Organisation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sectionOrg")}</CardTitle>
          <CardDescription>{t("sectionOrgHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fs">{t("defaultFederalState")}</Label>
            <Select
              value={form.defaultFederalState}
              onValueChange={(v) => setForm({ ...form, defaultFederalState: v as never })}
            >
              <SelectTrigger id="fs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATE_CODES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATE_NAMES[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vd">{t("defaultVacationDays")}</Label>
            <Input
              id="vd"
              type="number"
              min={0}
              max={60}
              step="0.5"
              value={form.defaultVacationDays}
              onChange={(e) => setForm({ ...form, defaultVacationDays: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section: Pausen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sectionBreak")}</CardTitle>
          <CardDescription>{t("sectionBreakHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="ab">{t("autoBreakLabel")}</Label>
              <p className="text-xs text-muted-foreground">{t("autoBreakHint")}</p>
            </div>
            <Switch
              id="ab"
              checked={form.autoBreakDefault === "AUTO"}
              onCheckedChange={(checked) =>
                setForm({ ...form, autoBreakDefault: checked ? "AUTO" : "MANUAL" })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Section: Überstunden */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sectionOvertime")}</CardTitle>
          <CardDescription>{t("sectionOvertimeHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>{t("carryoverEnabled")}</Label>
              <p className="text-xs text-muted-foreground">{t("carryoverEnabledHint")}</p>
            </div>
            <Switch
              checked={form.overtimeCarryoverCutoffEnabled}
              onCheckedChange={(checked) =>
                setForm({ ...form, overtimeCarryoverCutoffEnabled: checked })
              }
            />
          </div>

          {form.overtimeCarryoverCutoffEnabled && (
            <div className="space-y-1.5 pl-3">
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
        </CardContent>
      </Card>

      {/* Section: Sperrfrist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sectionLock")}</CardTitle>
          <CardDescription>{t("sectionLockHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="lw">{t("lockWindowDays")}</Label>
            <Input
              id="lw"
              type="number"
              min={0}
              max={365}
              value={form.timeEntryLockWindowDays}
              onChange={(e) => setForm({ ...form, timeEntryLockWindowDays: e.target.value })}
              className="max-w-[160px]"
            />
            <p className="text-xs text-muted-foreground">{t("lockWindowHint")}</p>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <Button type="submit" disabled={loading}>
        {t("save")}
      </Button>
    </form>
  );
}

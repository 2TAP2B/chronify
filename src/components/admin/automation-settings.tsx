"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatInZone } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ReportAutomationRun } from "@prisma/client";

export type AutomationConfigView = {
  enabled: boolean;
  frequency: "WEEKLY" | "MONTHLY";
  weeklyDay: number;
  monthlyDay: number;
  runHour: number;
  scope: "ALL" | "SELECTED";
  userIds: string[];
  subfolder: string;
};

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function AutomationSettings({
  config,
  runs,
  users,
  exportBaseDir,
}: {
  config: AutomationConfigView;
  runs: ReportAutomationRun[];
  users: { id: string; name: string }[];
  exportBaseDir: string | null;
}) {
  const t = useTranslations("adminAutomation");
  const locale = useLocale();
  const [form, setForm] = useState({
    enabled: config.enabled,
    frequency: config.frequency,
    weeklyDay: config.weeklyDay,
    monthlyDay: String(config.monthlyDay),
    runHour: String(config.runHour),
    scope: config.scope,
    userIds: new Set(config.userIds),
    subfolder: config.subfolder,
  });
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/report-automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          frequency: form.frequency,
          weeklyDay: form.weeklyDay,
          monthlyDay: Number(form.monthlyDay),
          runHour: Number(form.runHour),
          scope: form.scope,
          userIds: [...form.userIds],
          subfolder: form.subfolder,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      setMsg(t("saved"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/report-automation/run", { method: "POST" });
      const b = (await res.json().catch(() => ({}))) as {
        result?: { generated: number; failed: number; error?: string | null };
        error?: string;
      };
      if (b.result) {
        const { generated, failed } = b.result;
        if (generated === 0 && failed === 0) {
          setRunResult(t("runNothing", { generated, failed }));
        } else if (failed > 0) {
          setRunResult(t("runPartial", { generated, failed }));
        } else {
          setRunResult(t("runSuccess", { generated }));
        }
        if (b.result.error) setError(b.result.error);
        router.refresh();
      } else {
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">{t("enabled")}</Label>
                <p className="text-xs text-muted-foreground">{t("enabledHint")}</p>
              </div>
              <Switch
                id="enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="frequency">{t("frequency")}</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, frequency: v as "WEEKLY" | "MONTHLY" }))
                  }
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">{t("weekly")}</SelectItem>
                    <SelectItem value="MONTHLY">{t("monthly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.frequency === "WEEKLY" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="weeklyDay">{t("runDay")}</Label>
                  <Select
                    value={String(form.weeklyDay)}
                    onValueChange={(v) => setForm((f) => ({ ...f, weeklyDay: Number(v) }))}
                  >
                    <SelectTrigger id="weeklyDay">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_KEYS.map((key, i) => (
                        <SelectItem key={key} value={String(i + 1)}>
                          {t(`weekday.${key}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="monthlyDay">{t("runDay")}</Label>
                  <Input
                    id="monthlyDay"
                    type="number"
                    min={1}
                    max={31}
                    value={form.monthlyDay}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyDay: e.target.value }))}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="runHour">{t("runHour")}</Label>
                <Input
                  id="runHour"
                  type="number"
                  min={0}
                  max={23}
                  value={form.runHour}
                  onChange={(e) => setForm((f) => ({ ...f, runHour: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scope">{t("scope")}</Label>
                <Select
                  value={form.scope}
                  onValueChange={(v) => setForm((f) => ({ ...f, scope: v as "ALL" | "SELECTED" }))}
                >
                  <SelectTrigger id="scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t("scopeAll")}</SelectItem>
                    <SelectItem value="SELECTED">{t("scopeSelected")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.scope === "SELECTED" && (
              <div className="space-y-1.5">
                <Label>{t("selectedUsers")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {users.map((u) => {
                    const active = form.userIds.has(u.id);
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() =>
                          setForm((f) => {
                            const next = new Set(f.userIds);
                            if (next.has(u.id)) next.delete(u.id);
                            else next.add(u.id);
                            return { ...f, userIds: next };
                          })
                        }
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        {u.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5 max-w-md">
              <Label htmlFor="subfolder">{t("subfolder")}</Label>
              <Input
                id="subfolder"
                value={form.subfolder}
                onChange={(e) => setForm((f) => ({ ...f, subfolder: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {exportBaseDir ? t("baseDir", { dir: exportBaseDir }) : t("baseDirMissing")}
              </p>
            </div>

            {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={loading}>
                {t("save")}
              </Button>
              <Button type="button" variant="secondary" disabled={running} onClick={runNow}>
                {running ? t("running") : t("runNow")}
              </Button>
              {runResult && <span className="text-sm text-muted-foreground">{runResult}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("runsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRuns")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colPeriod")}</TableHead>
                  <TableHead>{t("colKind")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead>{t("colFiles")}</TableHead>
                  <TableHead>{t("colStarted")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.periodKey}</TableCell>
                    <TableCell className="text-sm">
                      {r.kind === "SCHEDULED" ? t("kindScheduled") : t("kindManual")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "SUCCESS"
                            ? "default"
                            : r.status === "PARTIAL"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {r.status === "SUCCESS"
                          ? t("statusSuccess")
                          : r.status === "PARTIAL"
                            ? t("statusPartial")
                            : t("statusError")}
                      </Badge>
                      {r.error && (
                        <p
                          className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                          title={r.error}
                        >
                          {r.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.generated}/{r.generated + r.failed}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatInZone(
                        r.startedAt,
                        "Europe/Berlin",
                        "dd.MM. HH:mm",
                        locale as "de" | "en"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

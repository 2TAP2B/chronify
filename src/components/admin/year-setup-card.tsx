"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Status = {
  year: number;
  activeUsers: number;
  entitlements: number;
  balances: number;
  setupComplete: boolean;
};

export function YearSetupCard() {
  const t = useTranslations("adminYearSetup");
  const confirm = useConfirm();
  const [year, setYear] = useState(new Date().getUTCFullYear() + 1);
  const [carriedOver, setCarriedOver] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    usersProcessed: number;
    entitlementsCreated: number;
    balancesCreated: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/year-setup?year=${year}`);
      if (!res.ok) throw new Error("error");
      const data = await res.json();
      setStatus(data);
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function run() {
    if (
      !(await confirm({
        title: t("confirmRun", { year }),
        variant: "destructive",
        confirmLabel: t("runSetup"),
      }))
    )
      return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/year-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, carriedOverFromPrev: carriedOver }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "error");
        return;
      }
      const data = await res.json();
      setResult({
        usersProcessed: data.usersProcessed,
        entitlementsCreated: data.entitlementsCreated,
        balancesCreated: data.balancesCreated,
      });
      loadStatus();
    } catch {
      setError("error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{year}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">{t("explanationTitle")}</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>{t("explanation1")}</li>
            <li>{t("explanation2")}</li>
            <li>{t("explanation3")}</li>
            <li>{t("explanation4")}</li>
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">{t("year")}:</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-md border px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={carriedOver} onCheckedChange={(v) => setCarriedOver(Boolean(v))} />
            {t("carriedOver")}
          </label>
        </div>

        {loading && <p className="text-sm text-muted-foreground">…</p>}
        {status && (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t("status")}:</span>
              {status.setupComplete ? (
                <Badge variant="default">{t("setupComplete")}</Badge>
              ) : (
                <Badge variant="secondary">{t("setupIncomplete")}</Badge>
              )}
            </div>
            <div>
              {t("activeUsers")}: {status.activeUsers}
            </div>
            <div>
              Entitlements: {status.entitlements}/{status.activeUsers}
            </div>
            <div>
              Balances: {status.balances}/{status.activeUsers}
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            {t("usersProcessed")}: {result.usersProcessed} · {t("entitlementsCreated")}:{" "}
            {result.entitlementsCreated} · {t("balancesCreated")}: {result.balancesCreated}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={run} disabled={running}>
          {t("runSetup")}
        </Button>
      </CardContent>
    </Card>
  );
}

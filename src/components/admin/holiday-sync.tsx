"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import type { FederalState } from "@prisma/client";
import { stateName } from "@/lib/federal-states";

export function HolidaySync({ defaultFederalState }: { defaultFederalState: FederalState }) {
  const t = useTranslations("adminHolidays");
  const [loading, setLoading] = useState<"single" | "all" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync(type: "single" | "all") {
    setLoading(type);
    setMsg(null);
    const year = new Date().getUTCFullYear();
    try {
      const body = type === "all" ? { year, all: true } : { year, state: defaultFederalState };
      const res = await fetch("/api/holidays/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setMsg((b as { error?: string }).error ?? "error");
        return;
      }
      const data = await res.json();
      const total = (data.results as { upserted: number }[]).reduce((s, r) => s + r.upserted, 0);
      setMsg(t("synced", { count: total }));
    } catch {
      setMsg("error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("syncTitle")}</CardTitle>
        <CardDescription>{t("state")}: {stateName(defaultFederalState)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => sync("single")}
          disabled={loading !== null}
        >
          {loading === "single" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {t("sync")}
        </Button>
        <Button
          variant="outline"
          onClick={() => sync("all")}
          disabled={loading !== null}
        >
          {loading === "all" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {t("syncAll")}
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </CardContent>
    </Card>
  );
}
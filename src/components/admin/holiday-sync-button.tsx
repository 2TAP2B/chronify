"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import type { FederalState } from "@prisma/client";

export function HolidaySyncButton({
  year,
  state,
  all,
}: {
  year: number;
  state?: FederalState;
  all?: boolean;
}) {
  const t = useTranslations("adminHolidays");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMsg(null);
    try {
      const body = all ? { year, all: true } : { year, state };
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
      window.location.reload();
    } catch {
      setMsg("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={sync} disabled={loading}>
      {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
      {all ? t("syncAll") : `${t("sync")} ${state ?? ""}`}
      {msg && <span className="ml-2 text-xs text-muted-foreground">{msg}</span>}
    </Button>
  );
}

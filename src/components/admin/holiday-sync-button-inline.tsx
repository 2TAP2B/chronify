"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import type { FederalState } from "@prisma/client";

export function HolidaySyncButtonInline({
  year,
  state,
}: {
  year: number;
  state: FederalState;
}) {
  const t = useTranslations("adminHolidays");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/holidays/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, state }),
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
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={sync} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        )}
        {t("sync")}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
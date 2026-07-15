"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Trash2, Eye, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Stats = {
  timeEntries: number;
  vacationRequests: number;
  sickNotes: number;
  auditLogs: number;
  notifications: number;
  inactiveUsers: number;
};

export function GdprCleanupPanel() {
  const t = useTranslations("gdpr");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<(Stats & { dryRun: boolean }) | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gdpr");
      const data = await res.json();
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const runCleanup = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/gdpr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      setResult(data);
      if (!dryRun) {
        setConfirmOpen(false);
        fetchStats();
      }
    } finally {
      setRunning(false);
    }
  };

  const items = stats
    ? [
        { key: "timeEntries", value: stats.timeEntries },
        { key: "vacationRequests", value: stats.vacationRequests },
        { key: "sickNotes", value: stats.sickNotes },
        { key: "auditLogs", value: stats.auditLogs },
        { key: "notifications", value: stats.notifications },
        { key: "inactiveUsers", value: stats.inactiveUsers },
      ]
    : [];

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{t(item.key)}</span>
              <span className={`text-lg font-bold ${item.value > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => runCleanup(true)} disabled={running}>
          <Eye className="h-4 w-4" />
          {t("dryRun")}
        </Button>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={running || !stats || stats.timeEntries + stats.sickNotes + stats.auditLogs + stats.notifications + stats.inactiveUsers === 0}>
              <Trash2 className="h-4 w-4" />
              {t("runCleanup")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {t("confirmTitle")}
              </DialogTitle>
              <DialogDescription>{t("confirmDescription")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={running}>
                {t("cancel")}
              </Button>
              <Button variant="destructive" onClick={() => runCleanup(false)} disabled={running}>
                {running ? t("running") : t("confirmDelete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {result && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{result.dryRun ? t("dryRunResult") : t("cleanupResult")}</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            {items.map((item) => (
              <span key={item.key}>
                {t(item.key)}: {String(result[item.key as keyof typeof result] ?? 0)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
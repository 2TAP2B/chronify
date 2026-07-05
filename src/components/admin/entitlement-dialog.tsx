"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EntitlementDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("adminUsers");
  const [totalDays, setTotalDays] = useState(30);
  const [currentDays, setCurrentDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const year = new Date().getUTCFullYear();

  useEffect(() => {
    if (open) {
      fetch(`/api/vacation?userId=${userId}&year=${year}`)
        .then((r) => r.json())
        .then((d) => {
          const ent = d.entitlement;
          if (ent?.totalDays !== undefined) {
            setTotalDays(ent.totalDays);
            if (ent.consumedDays !== undefined && ent.totalDays !== (d.defaultDays ?? 30)) {
              setCurrentDays(ent.totalDays);
            }
          }
        })
        .catch(() => {});
    }
  }, [open, userId, year]);

  async function onSave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust-entitlement", year, totalDays }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "error");
        return;
      }
      onOpenChange(false);
      window.location.reload();
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("adjustEntitlement")} – {userName}</DialogTitle>
          <DialogDescription>
            {currentDays !== null
              ? t("currentDays", { days: currentDays })
              : t("usingDefault")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="total-days">{t("totalDays")}</Label>
          <Input
            id="total-days"
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={totalDays}
            onChange={(e) => setTotalDays(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">{t("entitlementHint")}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>{t("cancel")}</Button>
          <Button onClick={onSave} disabled={loading}>{t("save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { X } from "lucide-react";

export function VacationCancelAction({
  requestId,
  variant = "ghost",
  showLabel = false,
}: {
  requestId: string;
  variant?: "ghost" | "outline" | "destructive";
  showLabel?: boolean;
}) {
  const t = useTranslations("vacation");
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (
      !(await confirm({
        title: t("confirmCancel"),
        variant: "destructive",
        confirmLabel: t("cancelRequest"),
      }))
    )
      return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vacation/${requestId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "error");
        return;
      }
      window.location.reload();
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size={showLabel ? "sm" : "icon"}
        variant={variant}
        className={showLabel ? "" : "h-8 w-8"}
        disabled={loading}
        onClick={cancel}
      >
        <X className={showLabel ? "mr-1 h-3.5 w-3.5" : "h-3.5 w-3.5"} />
        {showLabel && (loading ? "…" : t("cancelRequest"))}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

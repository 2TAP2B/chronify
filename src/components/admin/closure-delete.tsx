"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Trash2 } from "lucide-react";

export function ClosureDelete({
  closureId,
  closureName,
}: {
  closureId: string;
  closureName: string;
}) {
  const t = useTranslations("adminClosures");
  const tc = useTranslations("common");
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (
      !(await confirm({
        title: t("confirmDelete"),
        variant: "destructive",
        confirmLabel: t("delete"),
      }))
    )
      return;
    startTransition(async () => {
      const res = await fetch(`/api/business-closures/${closureId}`, { method: "DELETE" });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        setError(
          b.code === "CLOSURE_STARTED" ? t("deleteStarted") : (b.error ?? tc("errorGeneric"))
        );
        return;
      }
      window.location.reload();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        disabled={pending}
        aria-label={t("delete")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}

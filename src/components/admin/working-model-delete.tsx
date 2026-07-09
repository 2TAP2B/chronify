"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Trash2 } from "lucide-react";

export function WorkingModelDelete({ modelId }: { modelId: string }) {
  const t = useTranslations("adminWorkingModels");
  const confirm = useConfirm();
  const [, startTransition] = useTransition();
  async function del() {
    if (!await confirm({ title: t("confirmDelete"), variant: "destructive", confirmLabel: t("delete") })) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/working-models/${modelId}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        await confirm({ title: "Fehler", description: (b as { error?: string }).error ?? "error", confirmLabel: "OK" });
        return;
      }
      window.location.reload();
    });
  }
  return (
    <Button size="sm" variant="ghost" onClick={del}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

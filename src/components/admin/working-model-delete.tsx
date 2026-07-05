"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function WorkingModelDelete({ modelId }: { modelId: string }) {
  const t = useTranslations("adminWorkingModels");
  const [, startTransition] = useTransition();
  async function del() {
    if (!confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/working-models/${modelId}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert((b as { error?: string }).error ?? "error");
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

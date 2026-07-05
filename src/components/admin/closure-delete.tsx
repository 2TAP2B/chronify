"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function ClosureDelete({ closureId, closureName }: { closureId: string; closureName: string }) {
  const t = useTranslations("adminClosures");
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      await fetch(`/api/business-closures/${closureId}`, { method: "DELETE" });
      window.location.reload();
    });
  }

  return (
    <Button size="sm" variant="ghost" onClick={onDelete} disabled={pending} aria-label={t("delete")}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

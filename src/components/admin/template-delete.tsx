"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function TemplateDelete({ templateId, templateName }: { templateId: string; templateName: string }) {
  const t = useTranslations("adminWorkingModels");
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      await fetch(`/api/admin/working-model-templates/${templateId}`, { method: "DELETE" });
      window.location.reload();
    });
  }

  return (
    <Button size="sm" variant="ghost" onClick={onDelete} disabled={pending} aria-label={t("delete")}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

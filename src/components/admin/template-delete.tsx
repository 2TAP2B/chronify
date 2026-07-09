"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Trash2 } from "lucide-react";

export function TemplateDelete({ templateId, templateName }: { templateId: string; templateName: string }) {
  const t = useTranslations("adminWorkingModels");
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function onDelete() {
    if (!await confirm({ title: t("confirmDelete"), variant: "destructive", confirmLabel: t("delete") })) return;
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

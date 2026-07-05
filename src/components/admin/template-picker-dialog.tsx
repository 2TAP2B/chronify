"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { WorkingModelTemplate } from "@prisma/client";

export function TemplatePickerDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("adminWorkingModels");
  const [templates, setTemplates] = useState<WorkingModelTemplate[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/admin/working-model-templates")
        .then((r) => r.json())
        .then((d) => {
          setTemplates(d.templates ?? []);
          if (d.templates?.length > 0) {
            const def = d.templates.find((t: WorkingModelTemplate) => t.isDefault);
            setSelected(def?.id ?? d.templates[0].id);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  async function onAssign() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/working-model-templates/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", userId }),
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
          <DialogTitle>{t("assignModel")}</DialogTitle>
          <DialogDescription>{t("assignDescription")}</DialogDescription>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTemplates")}</p>
        ) : (
          <RadioGroup value={selected} onValueChange={setSelected} className="gap-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center gap-3 rounded-md border p-3">
                <RadioGroupItem value={tpl.id} id={tpl.id} />
                <div className="flex-1">
                  <Label htmlFor={tpl.id} className="font-medium">{tpl.name}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("weeklyTarget")}: {(tpl.weeklyTargetMinutes / 60).toFixed(1)} h
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>{t("cancel")}</Button>
          <Button onClick={onAssign} disabled={loading || !selected}>{t("assign")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

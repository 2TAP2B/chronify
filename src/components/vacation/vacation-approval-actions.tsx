"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Check, X } from "lucide-react";

export function VacationApprovalActions({ requestId }: { requestId: string }) {
  const t = useTranslations("vacation");
  const confirm = useConfirm();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    const msg = action === "approve" ? t("confirmApprove") : t("confirmReject");
    if (
      !(await confirm({
        title: msg,
        variant: action === "reject" ? "destructive" : "default",
        confirmLabel: t(action === "approve" ? "approve" : "reject"),
      }))
    )
      return;
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/vacation/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverNote: note || null }),
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
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="default"
          disabled={loading !== null}
          onClick={() => act("approve")}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          {loading === "approve" ? "…" : t("approve")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={loading !== null}
          onClick={() => act("reject")}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          {loading === "reject" ? "…" : t("reject")}
        </Button>
      </div>
      <Input
        type="text"
        placeholder={t("approverNotePlaceholder")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-7 w-48 text-xs"
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

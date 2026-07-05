"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { UserCheck, UserX } from "lucide-react";

export function UserToggleActive({
  userId,
  active,
  isSelf,
}: {
  userId: string;
  active: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations("adminUsers");
  const [, startTransition] = useTransition();

  async function toggle() {
    const action = active ? "deactivate" : "activate";
    if (active && !confirm(t("confirmDeactivate"))) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        const code = (b as { code?: string }).code;
        alert(code === "SELF_DEACTIVATE" ? t("cannotDeactivateSelf") : (b as { error?: string }).error ?? "error");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isSelf && active}
      onClick={toggle}
    >
      {active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
    </Button>
  );
}

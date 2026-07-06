"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Pencil, Trash2, UserX, UserCheck, Clock, CalendarDays, Timer } from "lucide-react";
import { UserDialog } from "@/components/admin/user-dialog";
import { TemplatePickerDialog } from "@/components/admin/template-picker-dialog";
import { EntitlementDialog } from "@/components/admin/entitlement-dialog";
import { OvertimeAdjustDialog } from "@/components/admin/overtime-adjust-dialog";

type User = {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  locale: string;
  federalState: string;
  timezone: string;
  breakMode: string;
  active: boolean;
};

export function UserRowMenu({ user, isSelf }: { user: User; isSelf: boolean }) {
  const t = useTranslations("adminUsers");
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showEntitlement, setShowEntitlement] = useState(false);
  const [showOvertime, setShowOvertime] = useState(false);

  async function toggleActive() {
    if (user.active && !confirm(t("confirmDeactivate"))) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: user.active ? "deactivate" : "activate" }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const b = await res.json().catch(() => ({}));
        if ((b as { code?: string }).code === "SELF_DEACTIVATE") {
          alert(t("cannotDeactivateSelf"));
        }
      }
    });
  }

  async function deleteUser() {
    if (!confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.reload();
      } else {
        const b = await res.json().catch(() => ({}));
        if ((b as { code?: string }).code === "HAS_DEPENDENCIES") {
          alert(t("hasDependencies"));
        } else {
          alert((b as { error?: string }).error ?? "error");
        }
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={pending} aria-label={t("actions")}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowEdit(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowTemplate(true)}>
            <Clock className="mr-2 h-4 w-4" />
            {t("assignModel")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowEntitlement(true)}>
            <CalendarDays className="mr-2 h-4 w-4" />
            {t("adjustEntitlement")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowOvertime(true)}>
            <Timer className="mr-2 h-4 w-4" />
            {t("adjustOvertime")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={toggleActive}
            disabled={isSelf && user.active}
            className={user.active ? "text-destructive" : ""}
          >
            {user.active ? (
              <>
                <UserX className="mr-2 h-4 w-4" />
                {t("deactivate")}
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                {t("activate")}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={deleteUser} disabled={isSelf} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showEdit && (
        <UserDialog
          mode="edit"
          user={user}
          open
          onOpenChange={setShowEdit}
        />
      )}
      {showTemplate && (
        <TemplatePickerDialog userId={user.id} open={showTemplate} onOpenChange={setShowTemplate} />
      )}
      {showEntitlement && (
        <EntitlementDialog userId={user.id} userName={user.name} open={showEntitlement} onOpenChange={setShowEntitlement} />
      )}
      {showOvertime && (
        <OvertimeAdjustDialog userId={user.id} userName={user.name} open={showOvertime} onOpenChange={setShowOvertime} />
      )}
    </>
  );
}

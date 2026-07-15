"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InactiveUser = {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  hireDate: string | null;
};

export function GdprUserAnonymize({ users }: { users: InactiveUser[] }) {
  const t = useTranslations("gdpr");
  const [target, setTarget] = useState<InactiveUser | null>(null);
  const [running, setRunning] = useState(false);

  const anonymize = async () => {
    if (!target) return;
    setRunning(true);
    try {
      await fetch("/api/admin/gdpr/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id }),
      });
      setTarget(null);
      window.location.reload();
    } finally {
      setRunning(false);
    }
  };

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noInactiveUsers")}</p>;
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("userName")}</TableHead>
            <TableHead>{t("userEmail")}</TableHead>
            <TableHead>{t("userHireDate")}</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name ?? "—"}</TableCell>
              <TableCell>{u.email ?? "—"}</TableCell>
              <TableCell>{u.hireDate ? new Date(u.hireDate).toLocaleDateString("de-DE") : "—"}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setTarget(u)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={target !== null} onOpenChange={(open) => { if (!open) setTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("anonymizeConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("anonymizeConfirmDescription", { name: target?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={running}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={anonymize} disabled={running}>
              {running ? t("running") : t("confirmAnonymize")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
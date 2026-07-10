"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

export function SickNoteRowActions({
  noteId,
  from: initialFrom,
  to: initialTo,
  aubUntil: initialAub,
  note: initialNote,
}: {
  noteId: string;
  from: string;
  to: string;
  aubUntil: string | null;
  note: string | null;
}) {
  const t = useTranslations("sickness");
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toInput(iso: string | null): string {
    if (!iso) return "";
    return new Date(iso).toISOString().slice(0, 10);
  }

  const [editFrom, setEditFrom] = useState(toInput(initialFrom));
  const [editTo, setEditTo] = useState(toInput(initialTo));
  const [editAub, setEditAub] = useState(toInput(initialAub));
  const [editNote, setEditNote] = useState(initialNote ?? "");

  function openEdit() {
    setEditFrom(toInput(initialFrom));
    setEditTo(toInput(initialTo));
    setEditAub(toInput(initialAub));
    setEditNote(initialNote ?? "");
    setEditOpen(true);
    setMenuOpen(false);
  }

  async function saveEdit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sickness/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: new Date(editFrom + "T00:00:00Z").toISOString(),
          to: new Date(editTo + "T00:00:00Z").toISOString(),
          aubUntil: editAub ? new Date(editAub + "T00:00:00Z").toISOString() : null,
          note: editNote || null,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "error");
        return;
      }
      setEditOpen(false);
      window.location.reload();
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  async function del() {
    setMenuOpen(false);
    if (!await confirm({ title: t("confirmDelete"), variant: "destructive", confirmLabel: t("delete") })) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sickness/${noteId}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        await confirm({ title: "Fehler", description: (b as { error?: string }).error ?? "error", confirmLabel: "OK" });
        return;
      }
      window.location.reload();
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={openEdit}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={del} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-from">{t("from")}</Label>
                <DatePicker
                  value={editFrom ? new Date(editFrom + "T00:00:00") : undefined}
                  onChange={(d) => d && setEditFrom(format(d, "yyyy-MM-dd"))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-to">{t("to")}</Label>
                <DatePicker
                  value={editTo ? new Date(editTo + "T00:00:00") : undefined}
                  onChange={(d) => d && setEditTo(format(d, "yyyy-MM-dd"))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-aub">{t("aubUntil")}</Label>
                <DatePicker
                  value={editAub ? new Date(editAub + "T00:00:00") : undefined}
                  onChange={(d) => d && setEditAub(format(d, "yyyy-MM-dd"))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-note">{t("note")}</Label>
              <Input id="edit-note" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={loading}>
              {t("cancel")}
            </Button>
            <Button onClick={saveEdit} disabled={loading}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
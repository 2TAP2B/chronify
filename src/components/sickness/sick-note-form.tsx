"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SickNoteForm() {
  const t = useTranslations("sickness");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [aubUntil, setAubUntil] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sickness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: new Date(from + "T00:00:00Z").toISOString(),
          to: new Date(to + "T00:00:00Z").toISOString(),
          aubUntil: aubUntil ? new Date(aubUntil + "T00:00:00Z").toISOString() : null,
          note: note || null,
        }),
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
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="from">{t("from")}</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">{t("to")}</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aubUntil">{t("aubUntil")}</Label>
          <Input id="aubUntil" type="date" value={aubUntil} onChange={(e) => setAubUntil(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">{t("note")}</Label>
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {t("submit")}
      </Button>
    </form>
  );
}

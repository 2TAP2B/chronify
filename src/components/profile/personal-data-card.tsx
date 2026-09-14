"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock, Pencil } from "lucide-react";
import { formatInZone } from "@/lib/datetime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OwnProfileView = {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  nfcCardId: string | null;
  role: "EMPLOYEE" | "ADMIN";
  hireDate: string | null;
  lastLoginAt: string | null;
  hasPassword: boolean;
};

function ReadOnlyRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-lg bg-muted/40 px-3 py-2 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm"}>{value}</dd>
    </div>
  );
}

export function PersonalDataCard({ profile }: { profile: OwnProfileView }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    if (firstName.trim() === "" && lastName.trim() === "") {
      setError(t("nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      setMsg(t("saved"));
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("personalData")}</CardTitle>
        <CardDescription>{t("personalDataHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ReadOnlyRow label={t("firstName")} value={profile.firstName || t("noValue")} />
          <ReadOnlyRow label={t("lastName")} value={profile.lastName || t("noValue")} />
          <ReadOnlyRow label={t("email")} value={profile.email} />
          <ReadOnlyRow label={t("username")} value={profile.name} />
          <ReadOnlyRow label={t("nfcCardId")} value={profile.nfcCardId || t("noValue")} mono />
          <ReadOnlyRow
            label={t("role")}
            value={
              <Badge variant={profile.role === "ADMIN" ? "default" : "secondary"}>
                {profile.role === "ADMIN" ? t("roleAdmin") : t("roleEmployee")}
              </Badge>
            }
          />
          <ReadOnlyRow
            label={t("hireDate")}
            value={
              profile.hireDate
                ? formatInZone(new Date(profile.hireDate), "UTC", "dd.MM.yyyy")
                : t("noValue")
            }
          />
          <ReadOnlyRow
            label={t("lastLoginAt")}
            value={
              profile.lastLoginAt
                ? formatInZone(new Date(profile.lastLoginAt), "Europe/Berlin", "dd.MM.yyyy HH:mm")
                : t("noValue")
            }
          />
        </dl>

        {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {editing ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">{t("firstName")}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  maxLength={50}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">{t("lastName")}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  maxLength={50}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? t("saving") : t("save")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setFirstName(profile.firstName ?? "");
                  setLastName(profile.lastName ?? "");
                  setError(null);
                  setMsg(null);
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" /> {t("editNames")}
            </Button>
          </div>
        )}

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("readOnlyHint")}
        </p>
      </CardContent>
    </Card>
  );
}

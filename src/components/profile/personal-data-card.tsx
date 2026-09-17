"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock, Trash2 } from "lucide-react";
import { formatInZone } from "@/lib/datetime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  avatarUrl: string | null;
};

/** Aligned single-column meta row (label left, value right). */
function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b py-2.5 last:border-b-0">
      <dt className="shrink-0 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 truncate text-sm text-right ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

/** Downscale + square-crop the picked image in the browser to keep it light. */
function cropToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(
          img,
          (img.width - size) / 2,
          (img.height - size) / 2,
          size,
          size,
          0,
          0,
          size,
          size
        );
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function PersonalDataCard({ profile }: { profile: OwnProfileView }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveNames(e: React.FormEvent) {
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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarPicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("avatarInvalid"));
      return;
    }
    setMsg(null);
    setError(null);
    setAvatarBusy(true);
    try {
      const dataUrl = await cropToDataUrl(file);
      if (!dataUrl) throw new Error(t("avatarInvalid"));
      const res = await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setError(null);
    setAvatarBusy(true);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: null }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setAvatarBusy(false);
    }
  }

  const initials = [profile.firstName, profile.lastName]
    .map((v) => v?.[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("personalData")}</CardTitle>
        <CardDescription>{t("personalDataHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar centered on top */}
        <div className="flex flex-col items-center gap-2">
          <Avatar className="size-24 ring-2 ring-border">
            {profile.avatarUrl && (
              <AvatarImage src={profile.avatarUrl} alt={profile.name} className="object-cover" />
            )}
            <AvatarFallback className="text-xl">{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-full text-xs"
              disabled={avatarBusy}
              aria-label={profile.avatarUrl ? t("avatarReplace") : t("avatarUpload")}
              onClick={() => fileInputRef.current?.click()}
            >
              {profile.avatarUrl ? t("avatarReplace") : t("avatarUpload")}
            </Button>
            {profile.avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                aria-label={t("avatarRemove")}
                title={t("avatarRemove")}
                disabled={avatarBusy}
                onClick={removeAvatar}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onAvatarPicked}
            disabled={avatarBusy}
          />
        </div>

        {/* Stacked editable fields: one per row */}
        <form onSubmit={saveNames} className="space-y-4" aria-label={t("personalData")}>
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
          <Button type="submit" disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </form>

        {/* Single-column context */}
        <dl className="rounded-lg bg-muted/30 px-4">
          <MetaRow label={t("username")} value={profile.name} />
          <MetaRow label={t("email")} value={profile.email} />
          <MetaRow label={t("nfcCardId")} value={profile.nfcCardId || t("noValue")} mono />
          <MetaRow
            label={t("role")}
            value={
              <Badge variant={profile.role === "ADMIN" ? "default" : "secondary"}>
                {profile.role === "ADMIN" ? t("roleAdmin") : t("roleEmployee")}
              </Badge>
            }
          />
          <MetaRow
            label={t("hireDate")}
            value={
              profile.hireDate
                ? formatInZone(new Date(profile.hireDate), "UTC", "dd.MM.yyyy")
                : t("noValue")
            }
          />
          <MetaRow
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

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("readOnlyHint")}
        </p>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ChangePasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("changePassword");
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 6) {
      setError(t("errorTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("errorMismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = (data as { error?: string }).error;
        if (code === "wrong_password") {
          setError(t("errorCurrent"));
        } else {
          setError((data as { error?: string }).error ?? "error");
        }
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }, 1500);
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{t("success")}</span>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">{t("current")}</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new">{t("new")}</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t("confirm")}</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "…" : t("submit")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
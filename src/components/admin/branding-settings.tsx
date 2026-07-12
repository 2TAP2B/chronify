"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, X, Image as ImageIcon } from "lucide-react";

type BrandingForm = {
  appName: string;
  appLogo: string | null;
  loginImage: string | null;
  loginQuote: string | null;
  loginQuoteAuthor: string | null;
};

export function BrandingSettings({ settings }: { settings: BrandingForm }) {
  const t = useTranslations("branding");
  const [form, setForm] = useState<BrandingForm>(settings);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const loginImgRef = useRef<HTMLInputElement>(null);

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      setError(t("logoTooLarge"));
      return;
    }
    const base64 = await fileToBase64(file);
    setForm({ ...form, appLogo: base64 });
    setError(null);
  }

  async function onLoginImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      setError(t("imageTooLarge"));
      return;
    }
    const base64 = await fileToBase64(file);
    setForm({ ...form, loginImage: base64 });
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: form.appName,
          appLogo: form.appLogo,
          loginImage: form.loginImage,
          loginQuote: form.loginQuote,
          loginQuoteAuthor: form.loginQuoteAuthor,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "error");
        return;
      }
      setMsg(t("saved"));
    } catch {
      setError("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sectionBranding")}</CardTitle>
          <CardDescription>{t("sectionBrandingHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="appName">{t("appName")}</Label>
            <Input
              id="appName"
              value={form.appName}
              onChange={(e) => setForm({ ...form, appName: e.target.value })}
              maxLength={50}
              placeholder="Puku Zeiterfassung"
            />
            <p className="text-xs text-muted-foreground">{t("appNameHint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{t("logo")}</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted/30">
                {form.appLogo ? (
                  <img src={form.appLogo} alt="Logo" className="h-12 w-12 object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <input
                ref={logoRef}
                type="file"
                accept="image/svg+xml,image/png,image/jpeg"
                className="hidden"
                onChange={onLogoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => logoRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {t("upload")}
              </Button>
              {form.appLogo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm({ ...form, appLogo: null })}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  {t("remove")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sectionLogin")}</CardTitle>
          <CardDescription>{t("sectionLoginHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("loginImage")}</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                {form.loginImage ? (
                  <img src={form.loginImage} alt="Login" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <input
                ref={loginImgRef}
                type="file"
                accept="image/svg+xml,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onLoginImageChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loginImgRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {t("upload")}
              </Button>
              {form.loginImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm({ ...form, loginImage: null })}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  {t("remove")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("loginImageHint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loginQuote">{t("loginQuote")}</Label>
            <Textarea
              id="loginQuote"
              value={form.loginQuote ?? ""}
              onChange={(e) => setForm({ ...form, loginQuote: e.target.value || null })}
              maxLength={200}
              rows={3}
              placeholder="Erfassen Sie Ihre Arbeitszeit einfach und präzise – nach deutschen Arbeitsgesetzen."
            />
            <p className="text-xs text-muted-foreground">{t("loginQuoteHint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loginQuoteAuthor">{t("loginQuoteAuthor")}</Label>
            <Input
              id="loginQuoteAuthor"
              value={form.loginQuoteAuthor ?? ""}
              onChange={(e) => setForm({ ...form, loginQuoteAuthor: e.target.value || null })}
              maxLength={50}
              placeholder="Puku Zeiterfassung"
            />
            <p className="text-xs text-muted-foreground">{t("loginQuoteAuthorHint")}</p>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "…" : t("save")}
      </Button>
    </form>
  );
}
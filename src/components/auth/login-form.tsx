"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useTheme } from "next-themes";
import { AlertCircle, KeyRound, Moon, Sun } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";

const OIDC_ENABLED = !!process.env.NEXT_PUBLIC_OIDC_ENABLED;

type Branding = {
  appName: string;
  appLogo: string | null;
  loginImage: string | null;
  loginQuote: string | null;
  loginQuoteAuthor: string | null;
};

export function LoginForm({
  passwordLoginDisabled = false,
  className,
  ...props
}: {
  passwordLoginDisabled?: boolean;
} & React.ComponentProps<"div">) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((d: Branding) => setBranding(d))
      .catch(() => {});
  }, []);

  const displayQuote = branding?.loginQuote ?? t("loginQuote");
  const displayAuthor = branding?.loginQuoteAuthor ?? tCommon("appName");
  const loginImage = branding?.loginImage;
  const appLogo = branding?.appLogo;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    await signIn("credentials", {
      email,
      password,
      callbackUrl: `/${locale}/dashboard`,
    });
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center">
                  {appLogo ? (
                    <img src={appLogo} alt="Logo" className="h-12 w-12 object-contain" />
                  ) : (
                    <Logo className="h-12 w-12" />
                  )}
                </div>
                <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
                <p className="text-balance text-muted-foreground">{t("loginSubtitle")}</p>
              </div>

              {!passwordLoginDisabled && (
                <form onSubmit={onSubmit} className="contents">
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t("emailOrUsername")}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="text"
                      autoComplete="username"
                      placeholder="m@example.com"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t("password")}</Label>
                      <Link
                        href={`/${locale}/forgot-password`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {t("forgotPassword")}
                      </Link>
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
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
                    {loading ? "…" : t("loginButton")}
                  </Button>

                  {OIDC_ENABLED && (
                    <>
                      <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">{t("or")}</span>
                        </div>
                      </div>
                    </>
                  )}
                </form>
              )}

              {passwordLoginDisabled && !OIDC_ENABLED && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{t("passwordLoginDisabledHint")}</span>
                </div>
              )}

              {passwordLoginDisabled && OIDC_ENABLED && (
                <p className="text-center text-sm text-muted-foreground">
                  {t("passwordLoginDisabledHint")}
                </p>
              )}

              {OIDC_ENABLED && (
                <Button
                  type="button"
                  variant={passwordLoginDisabled ? "default" : "outline"}
                  className="w-full"
                  disabled={loading}
                  onClick={() => signIn("pocket-id", { callbackUrl: `/${locale}/dashboard` })}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {t("oidcLogin")}
                </Button>
              )}
            </div>
          </div>
          <div className="relative hidden bg-primary md:block">
            {loginImage ? (
              <div className="absolute inset-0">
                <img src={loginImage} alt="" className="h-full w-full object-cover" />
                {/* scrim: keeps the panel dark so any image stays legible */}
                <div className="absolute inset-0 bg-primary/60" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-foreground/20" />
            )}
            {/* Clean SaaS panel: brand only — quote text lives on the left */}
            <div className="relative flex h-full flex-col items-center justify-center p-8 text-white">
              {appLogo ? (
                <img src={appLogo} alt="Logo" className="h-20 w-20 object-contain" />
              ) : (
                <Logo className="h-20 w-20 text-white" />
              )}
              <span className="mt-4 text-sm font-medium uppercase tracking-[0.2em] text-white/80">
                {branding?.appName ?? tCommon("appName")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Quote: quiet footer strip, always readable on light background */}
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        <span className="italic">&bdquo;{displayQuote}&ldquo;</span>
        <span className="mx-1.5">·</span>
        <span className="not-italic">{displayAuthor}</span>
      </p>
      <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
        <span>{branding?.appName ?? tCommon("appName")}</span>
        <div className="flex gap-3">
          <a href={`/${locale}/privacy`} className="hover:text-foreground underline">
            {tCommon("privacy")}
          </a>
          <a href={`/${locale}/imprint`} className="hover:text-foreground underline">
            {tCommon("imprint")}
          </a>
        </div>
      </div>
    </div>
  );
}

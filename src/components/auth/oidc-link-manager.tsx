"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { KeyRound, Link2, Unlink, Loader2 } from "lucide-react";

export function OidcLinkManager({
  linked,
  providerName,
}: {
  linked: boolean;
  providerName: string;
}) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  async function link() {
    setLoading(true);
    signIn("pocket-id", { callbackUrl: window.location.href });
  }

  async function unlink() {
    if (
      !(await confirm({
        title: t("oidcUnlinkConfirm"),
        variant: "destructive",
        confirmLabel: t("oidcUnlinkButton"),
      }))
    )
      return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/oidc/unlink", { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        await confirm({
          title: tc("error"),
          description: (b as { error?: string }).error ?? tc("errorGeneric"),
          confirmLabel: tc("ok"),
        });
        return;
      }
      window.location.reload();
    } catch {
      await confirm({
        title: tc("error"),
        description: tc("errorGeneric"),
        confirmLabel: tc("ok"),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t("oidcLink")}
        </CardTitle>
        <CardDescription>{t("oidcLinkHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        {linked ? (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="default">
                {providerName} {t("oidcLinked")}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={unlink} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="mr-1.5 h-4 w-4" />
              )}
              {t("oidcUnlinkButton")}
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">{t("oidcNotLinked")}</span>
            <Button variant="outline" size="sm" onClick={link} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-1.5 h-4 w-4" />
              )}
              {t("oidcLinkButton")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

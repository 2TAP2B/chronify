import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemePicker } from "@/components/theme-picker";
import { OidcLinkManager } from "@/components/auth/oidc-link-manager";
import { GdprExportButton } from "@/components/profile/gdpr-export-button";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const session = await auth();
  if (!session?.user?.id) return null;

  const oidcAccount = await db.account.findFirst({
    where: { userId: session.user.id, provider: "pocket-id" },
    select: { id: true },
  });

  const oidcEnabled = !!process.env.NEXT_PUBLIC_OIDC_ENABLED;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {oidcEnabled && (
        <OidcLinkManager linked={!!oidcAccount} providerName="Pocket-ID" />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("appearance")}</CardTitle>
          <CardDescription>{t("appearanceHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dataTitle")}</CardTitle>
          <CardDescription>{t("dataHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <GdprExportButton />
            <p className="text-xs text-muted-foreground">{t("dataExportDescription")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
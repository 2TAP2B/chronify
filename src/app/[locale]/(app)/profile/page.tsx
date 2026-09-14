import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnProfile } from "@/server/services/profile";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemePicker } from "@/components/theme-picker";
import { OidcLinkManager } from "@/components/auth/oidc-link-manager";
import { GdprExportButton } from "@/components/profile/gdpr-export-button";
import { PersonalDataCard, type OwnProfileView } from "@/components/profile/personal-data-card";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user, oidcAccount] = await Promise.all([
    getOwnProfile(session.user.id),
    db.account.findFirst({
      where: { userId: session.user.id, provider: "pocket-id" },
      select: { id: true },
    }),
  ]);

  const profile: OwnProfileView = {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    nfcCardId: user.nfcCardId,
    role: user.role,
    hireDate: user.hireDate?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    hasPassword: user.hasPassword,
  };

  const oidcEnabled = !!process.env.NEXT_PUBLIC_OIDC_ENABLED;
  const oidcOnly = !profile.hasPassword && !!oidcAccount;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <PersonalDataCard profile={profile} />

      <Card>
        <CardHeader>
          <CardTitle>{t("appearance")}</CardTitle>
          <CardDescription>{t("appearanceHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>

      {!oidcOnly && (
        <Card>
          <CardHeader>
            <CardTitle>{t("passwordTitle")}</CardTitle>
            <CardDescription>{t("passwordHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href={`/${locale}/change-password`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("changePassword")}
            </a>
          </CardContent>
        </Card>
      )}

      {oidcEnabled && <OidcLinkManager linked={!!oidcAccount} providerName="Pocket-ID" />}

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

import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GdprRetentionSettings } from "@/components/admin/gdpr-retention-settings";
import { GdprCleanupPanel } from "@/components/admin/gdpr-cleanup-panel";
import { GdprUserAnonymize } from "@/components/admin/gdpr-user-anonymize";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function GdprPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gdpr");

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;

  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const inactiveUsers = await db.user.findMany({
    where: { active: false },
    select: { id: true, name: true, email: true, createdAt: true, hireDate: true },
    orderBy: { name: "asc" },
  });

  const mappedUsers = inactiveUsers.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    hireDate: u.hireDate?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("retentionTitle")}</CardTitle>
          <CardDescription>{t("retentionDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <GdprRetentionSettings
            retentionYears={settings.retentionYears}
            sickNoteRetentionMonths={settings.sickNoteRetentionMonths}
            auditLogRetentionMonths={settings.auditLogRetentionMonths}
            imprintName={settings.imprintName}
            imprintAddress={settings.imprintAddress}
            imprintEmail={settings.imprintEmail}
            imprintPhone={settings.imprintPhone}
            privacyPolicyUrl={settings.privacyPolicyUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cleanupTitle")}</CardTitle>
          <CardDescription>{t("cleanupDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <GdprCleanupPanel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("anonymizeTitle")}</CardTitle>
          <CardDescription>{t("anonymizeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <GdprUserAnonymize users={mappedUsers} />
        </CardContent>
      </Card>
    </div>
  );
}
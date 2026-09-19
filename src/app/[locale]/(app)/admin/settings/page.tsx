import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettings } from "@/server/services/admin-settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { BrandingSettings } from "@/components/admin/branding-settings";
import { YearSetupCard } from "@/components/admin/year-setup-card";
import { HolidaySync } from "@/components/admin/holiday-sync";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminSettings");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const settings = await getSettings(session.user);
  const appLocale = (await getLocale()) as "de" | "en";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <BrandingSettings settings={settings} />

      <SettingsForm settings={settings} />

      <HolidaySync defaultFederalState={settings.defaultFederalState} />

      <YearSetupCard />
    </div>
  );
}

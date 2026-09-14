import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  exportBaseDir,
  getReportAutomation,
  listReportAutomationRuns,
} from "@/server/services/report-automation";
import {
  AutomationSettings,
  type AutomationConfigView,
} from "@/components/admin/automation-settings";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminAutomationPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminAutomation");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const actor = {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  };
  const [config, runs, users] = await Promise.all([
    getReportAutomation(actor),
    listReportAutomationRuns({ actor, limit: 10 }),
    db.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const view: AutomationConfigView = {
    enabled: config.enabled,
    frequency: config.frequency,
    weeklyDay: config.weeklyDay,
    monthlyDay: config.monthlyDay,
    runHour: config.runHour,
    scope: config.scope,
    userIds: config.userIds,
    subfolder: config.subfolder,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("heading")}</h1>
      <AutomationSettings config={view} runs={runs} users={users} exportBaseDir={exportBaseDir()} />
    </div>
  );
}

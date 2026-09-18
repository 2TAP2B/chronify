import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WorkOverviewPanel } from "@/components/admin/work-overview";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminWorkOverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);
  const t = await getTranslations("workOverview");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <WorkOverviewPanel currentUserId={session.user.id} year={new Date().getUTCFullYear()} />
    </div>
  );
}

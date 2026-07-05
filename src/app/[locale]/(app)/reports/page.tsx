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
import { ReportDownloader } from "@/components/reports/report-downloader";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ReportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("reports");
  const session = await auth();
  if (!session?.user?.id) return null;

  let users: { id: string; name: string }[] = [];
  if (session.user.role === "ADMIN") {
    users = await db.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("personalReport")}</CardTitle>
          <CardDescription>{t("hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportDownloader
            defaultFrom={defaultFrom}
            defaultTo={defaultTo}
            users={[]}
            isAdmin={false}
          />
        </CardContent>
      </Card>

      {session.user.role === "ADMIN" && users.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("adminReport")}</CardTitle>
            <CardDescription>{t("allUsers")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportDownloader
              defaultFrom={defaultFrom}
              defaultTo={defaultTo}
              users={users}
              isAdmin
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

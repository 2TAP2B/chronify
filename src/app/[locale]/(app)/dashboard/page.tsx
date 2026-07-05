import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("welcome", { name: session?.user?.name ?? "Benutzer" })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("todayWorked")}</CardDescription>
            <CardTitle className="text-2xl">00:00</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{t("noTimerRunning")}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("weekWorked")}</CardDescription>
            <CardTitle className="text-2xl">00:00</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("overtimeBalance")}</CardDescription>
            <CardTitle className="text-2xl">00:00</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("vacationRemaining")}</CardDescription>
            <CardTitle className="text-2xl">30 Tage</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("noTimerRunning")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Timer &amp; Stundenzettel folgen in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

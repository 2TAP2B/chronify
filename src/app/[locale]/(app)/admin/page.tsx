import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Clock,
  CalendarDays,
  CalendarOff,
  CalendarCheck,
  Stethoscope,
  Settings,
  Upload,
  FileText,
  TrendingUp,
} from "lucide-react";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminDashboard");
  const tNav = await getTranslations("nav");
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") redirect(`/${locale}/dashboard`);

  const [activeUsers, pendingVacation, pendingSick, recentAudit] = await Promise.all([
    db.user.count({ where: { active: true } }),
    db.vacationRequest.count({ where: { status: "PENDING" } }),
    db.sickNote.count(),
    db.auditLog.findMany({
      take: 5,
      orderBy: { at: "desc" },
      include: {
        actor: { select: { name: true } },
      },
    }),
  ]);

  const cards = [
    { href: "/admin/users", icon: Users, label: tNav("users"), desc: t("manageUsers") },
    {
      href: "/admin/working-models",
      icon: Clock,
      label: tNav("workingModels"),
      desc: t("manageModels"),
    },
    {
      href: "/admin/holidays",
      icon: CalendarDays,
      label: tNav("holidays"),
      desc: t("manageHolidays"),
    },
    {
      href: "/admin/business-closures",
      icon: CalendarOff,
      label: tNav("businessClosures"),
      desc: t("manageClosures"),
    },
    {
      href: "/admin/vacation-approvals",
      icon: CalendarCheck,
      label: tNav("vacationApprovals"),
      desc: t("manageVacation"),
    },
    { href: "/admin/sickness", icon: Stethoscope, label: tNav("sickness"), desc: t("manageSick") },
    { href: "/admin/settings", icon: Settings, label: tNav("settings"), desc: t("manageSettings") },
    { href: "/admin/import", icon: Upload, label: tNav("import"), desc: t("manageImport") },
    { href: "/admin/audit-log", icon: FileText, label: t("auditLog"), desc: t("manageAudit") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("activeUsers")}</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">{activeUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("pendingVacation")}</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums text-amber-600">
              {pendingVacation}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("sickNotes")}</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">{pendingSick}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={`/${locale}${card.href}`}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{card.label}</CardTitle>
                      <CardDescription className="text-xs">{card.desc}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      {recentAudit.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              {t("recentActivity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAudit.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between border-b pb-2 text-sm last:border-0"
                >
                  <div>
                    <span className="font-medium">{log.actor?.name ?? "—"}</span>
                    <span className="ml-2 text-muted-foreground">{log.action}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.at).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { PwaManager } from "@/components/pwa/pwa-manager";
import { db } from "@/lib/db";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: true, firstName: true, lastName: true },
  });

  const t = await getTranslations("nav");

  const navItems = [
    { href: "/dashboard", label: t("dashboard"), icon: "LayoutDashboard" },
    { href: "/timesheet", label: t("timesheet"), icon: "CalendarDays" },
    { href: "/calendar", label: t("calendar"), icon: "Calendar" },
    { href: "/overtime", label: t("overtime"), icon: "Clock" },
    { href: "/vacation", label: t("vacation"), icon: "Plane" },
    { href: "/sickness", label: t("sickness"), icon: "HeartPulse" },
    { href: "/reports", label: t("reports"), icon: "FileText" },
    { href: "/team", label: t("team"), icon: "Users" },
  ];

  const adminItems = [
    { href: "/admin/users", label: t("users"), icon: "UserCog" },
    { href: "/admin/working-models", label: t("workingModels"), icon: "Clock" },
    { href: "/admin/holidays", label: t("holidays"), icon: "CalendarOff" },
    { href: "/admin/vacation-approvals", label: t("vacationApprovals"), icon: "CheckCheck" },
    { href: "/admin/sickness", label: t("sickness"), icon: "HeartPulse" },
    { href: "/admin/settings", label: t("settings"), icon: "Settings" },
  ];

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <AppSidebar
        navItems={navItems}
        adminItems={user?.role === "ADMIN" ? adminItems : []}
        userName={user?.name ?? "Benutzer"}
        userEmail={user?.email ?? ""}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <AppHeader userName={user?.name ?? "Benutzer"} />
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
      <PwaManager />
    </div>
  );
}

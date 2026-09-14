import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user, settings] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        mustChangePassword: true,
      },
    }),
    db.orgSettings.findUnique({
      where: { id: "singleton" },
      select: { appName: true, appLogo: true },
    }),
  ]);

  if (!user) {
    redirect("/api/auth/signout");
  }

  if (user.mustChangePassword) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "";
    if (!pathname.includes("/change-password")) {
      const locale = pathname.split("/")[1] || "de";
      redirect(`/${locale}/change-password`);
    }
  }

  const t = await getTranslations("nav");

  const navItems = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/timesheet", label: t("timesheet") },
    { href: "/overtime", label: t("overtime") },
    { href: "/vacation", label: t("vacation") },
    { href: "/sickness", label: t("sickness") },
    { href: "/reports", label: t("reports") },
    { href: "/team", label: t("team") },
  ];

  const adminItems =
    user?.role === "ADMIN"
      ? [
          { href: "/admin", label: t("adminDashboard") },
          { href: "/admin/users", label: t("users") },
          { href: "/admin/working-models", label: t("workingModels") },
          { href: "/admin/automation", label: t("automation") },
          { href: "/admin/holidays", label: t("holidays") },
          {
            href: "/admin/business-closures",
            label: t("businessClosures"),
          },
          {
            href: "/admin/vacation-approvals",
            label: t("vacationApprovals"),
          },
          { href: "/admin/sickness", label: t("sickness") },
          { href: "/admin/gdpr", label: t("gdpr") },
        ]
      : [];

  const branding = settings
    ? { appName: settings.appName, appLogo: settings.appLogo }
    : { appName: "Chronify", appLogo: null };

  return (
    <SidebarProvider>
      <AppSidebar
        variant="inset"
        navItems={navItems}
        adminItems={adminItems}
        user={{
          name: user?.name ?? "Benutzer",
          email: user?.email ?? "",
        }}
        branding={branding}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 overflow-x-hidden px-4 py-4 pb-24 md:gap-6 md:px-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  );
}

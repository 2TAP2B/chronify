import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { PwaManager } from "@/components/pwa/pwa-manager";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    redirect("/api/auth/signout");
  }

  const t = await getTranslations("nav");

  const navItems = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/timesheet", label: t("timesheet") },
    { href: "/calendar", label: t("calendar") },
    { href: "/overtime", label: t("overtime") },
    { href: "/vacation", label: t("vacation") },
    { href: "/sickness", label: t("sickness") },
    { href: "/reports", label: t("reports") },
    { href: "/team", label: t("team") },
  ];

  const adminItems =
    user?.role === "ADMIN"
      ? [
          { href: "/admin/users", label: t("users") },
          { href: "/admin/working-models", label: t("workingModels") },
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
          { href: "/admin/settings", label: t("settings") },
        ]
      : [];

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
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
      <PwaManager />
    </SidebarProvider>
  );
}

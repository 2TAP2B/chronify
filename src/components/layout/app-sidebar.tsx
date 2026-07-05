"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/layout/logo";
import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const locale = useLocale();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = (Icons as unknown as Record<string, React.FC<LucideProps>>)[item.icon] ?? Icons.Circle;
        const href = `/${locale}${item.href}`;
        const active =
          pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar({
  navItems,
  adminItems,
  userName,
  userEmail,
}: {
  navItems: NavItem[];
  adminItems: NavItem[];
  userName: string;
  userEmail: string;
}) {
  const t = useTranslations("nav");
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-background">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Logo className="h-7 w-7" />
        <span className="text-lg font-semibold">Puku</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks items={navItems} />
        {adminItems.length > 0 && (
          <>
            <Separator className="my-4" />
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("admin")}
            </p>
            <NavLinks items={adminItems} />
          </>
        )}
      </div>
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {userEmail}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Clock, ClipboardList, Plus, Sun, Thermometer } from "lucide-react";

import { TimeEntryDialog } from "@/components/timesheet/time-entry-dialog";
import { cn } from "@/lib/utils";

const leadingItems = [
  { href: "timesheet", labelKey: "timesheet", Icon: ClipboardList },
  { href: "overtime", labelKey: "overtime", Icon: Clock },
] as const;

const trailingItems = [
  { href: "vacation", labelKey: "vacation", Icon: Sun },
  { href: "sickness", labelKey: "sickness", Icon: Thermometer },
] as const;

function todayLocalIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function MobileNavItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof Clock;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("size-5", active && "stroke-[2.5]")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function isActive(pathname: string, locale: string, path: string): boolean {
  const href = `/${locale}/${path}`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const tNav = useTranslations("nav");
  const tTimesheet = useTranslations("timesheet");
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const hrefFor = (path: string) => `/${locale}/${path}`;

  return (
    <>
      <nav
        aria-label={tNav("mobileNavAria")}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-2">
          {leadingItems.map((item) => (
            <MobileNavItem
              key={item.href}
              href={hrefFor(item.href)}
              label={tNav(item.labelKey)}
              Icon={item.Icon}
              active={isActive(pathname, locale, item.href)}
            />
          ))}
          <div className="relative flex justify-center">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-label={tTimesheet("add")}
              className={cn(
                "absolute -top-5 flex size-12 items-center justify-center rounded-full",
                "bg-primary text-primary-foreground shadow-lg ring-2 ring-background",
                "transition-[transform,background-color] hover:bg-primary/90 active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <Plus className="size-6" />
            </button>
          </div>
          {trailingItems.map((item) => (
            <MobileNavItem
              key={item.href}
              href={hrefFor(item.href)}
              label={tNav(item.labelKey)}
              Icon={item.Icon}
              active={isActive(pathname, locale, item.href)}
            />
          ))}
        </div>
      </nav>
      {addOpen && (
        <TimeEntryDialog
          open={addOpen}
          mode="create"
          initial={{
            date: todayLocalIso(),
            startAt: null,
            endAt: null,
            breakMinutes: 0,
            type: "WORK",
            note: null,
          }}
          onClose={() => setAddOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import {
  Clock,
  UserCog,
  CalendarOff,
  DoorClosed,
  CheckCheck,
  HeartPulse,
  Settings,
  LayoutDashboard,
  Shield,
  Circle,
  type LucideIcon,
} from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/components/nav-main"

const iconMap: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/users": UserCog,
  "/admin/working-models": Clock,
  "/admin/holidays": CalendarOff,
  "/admin/business-closures": DoorClosed,
  "/admin/vacation-approvals": CheckCheck,
  "/admin/sickness": HeartPulse,
  "/admin/settings": Settings,
  "/admin/gdpr": Shield,
}

export function NavAdmin({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations("nav")
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t("admin")}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const href = `/${locale}${item.href}`
          const active =
            pathname === href || pathname.startsWith(`${href}/`)
          const Icon = iconMap[item.href] ?? Circle
          return (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                asChild
                isActive={active}
                tooltip={item.label}
                onClick={() => setOpenMobile(false)}
                className={cn(
                  active &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                )}
              >
                <Link href={href}>
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

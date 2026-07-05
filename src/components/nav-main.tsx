"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale } from "next-intl"
import {
  LayoutDashboard,
  CalendarDays,
  Calendar,
  Clock,
  Plane,
  HeartPulse,
  DoorClosed,
  FileText,
  Users,
  Circle,
  type LucideIcon,
} from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export type NavItem = {
  href: string
  label: string
}

const iconMap: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/timesheet": CalendarDays,
  "/calendar": Calendar,
  "/overtime": Clock,
  "/vacation": Plane,
  "/sickness": HeartPulse,
  "/reports": FileText,
  "/team": Users,
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const locale = useLocale()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
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
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

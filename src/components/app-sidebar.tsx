"use client"

import * as React from "react"
import Link from "next/link"
import type { NavItem } from "@/components/nav-main"
import { NavMain } from "@/components/nav-main"
import { NavAdmin } from "@/components/nav-documents"
import { NavUser } from "@/components/nav-user"
import { Logo } from "@/components/layout/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar({
  navItems,
  adminItems,
  user,
  branding,
  ...props
}: {
  navItems: NavItem[]
  adminItems: NavItem[]
  user: { name: string; email: string }
  branding?: { appName: string; appLogo: string | null }
} & React.ComponentProps<typeof Sidebar>) {
  const { setOpenMobile } = useSidebar()
  const appName = branding?.appName ?? "Chronify"
  const appLogo = branding?.appLogo
  const nameParts = appName.split(" ")
  const primary = nameParts[0] ?? "Chronify"
  const secondary = nameParts.slice(1).join(" ") || "Zeiterfassung"
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[slot=sidebar-menu-button]:!p-1.5"
              asChild
              onClick={() => setOpenMobile(false)}
            >
              <Link href="/de/dashboard">
                {appLogo ? (
                  <img src={appLogo} alt={appName} className="h-7 w-7 object-contain" />
                ) : (
                  <Logo className="h-7 w-7" />
                )}
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">{primary}</span>
                  <span className="text-xs text-muted-foreground">
                    {secondary}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        {adminItems.length > 0 && <NavAdmin items={adminItems} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

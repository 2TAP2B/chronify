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
} from "@/components/ui/sidebar"

export function AppSidebar({
  navItems,
  adminItems,
  user,
  ...props
}: {
  navItems: NavItem[]
  adminItems: NavItem[]
  user: { name: string; email: string }
} & React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[slot=sidebar-menu-button]:!p-1.5"
              asChild
            >
              <Link href="/de/dashboard">
                <Logo className="h-7 w-7" />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Puku</span>
                  <span className="text-xs text-muted-foreground">
                    Zeiterfassung
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

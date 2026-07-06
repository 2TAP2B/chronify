"use client"

import { Fragment } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const navLabelMap: Record<string, string> = {
  dashboard: "dashboard",
  timesheet: "timesheet",
  calendar: "calendar",
  overtime: "overtime",
  vacation: "vacation",
  sickness: "sickness",
  "closure-choices": "closureChoices",
  reports: "reports",
  team: "team",
  admin: "admin",
  users: "users",
  "working-models": "workingModels",
  holidays: "holidays",
  "business-closures": "businessClosures",
  "vacation-approvals": "vacationApprovals",
  settings: "settings",
  profile: "profile",
}

export function SiteHeader() {
  const pathname = usePathname()
  const locale = useLocale()
  const tNav = useTranslations("nav")
  const tCommon = useTranslations("common")
  const { theme, setTheme } = useTheme()

  const segments = pathname
    .replace(`/${locale}`, "")
    .split("/")
    .filter(Boolean)

  const crumbs = segments.map((seg, i) => {
    const href = `/${locale}/${segments.slice(0, i + 1).join("/")}`
    const labelKey = navLabelMap[seg] ?? seg
    let label: string
    if (labelKey === "admin") {
      label = tNav("admin")
    } else if (segments[0] === "admin") {
      label = tNav(labelKey as never) ?? seg
    } else {
      label = tNav(labelKey as never) ?? tCommon(labelKey as never) ?? seg
    }
    return { href, label, isLast: i === segments.length - 1 }
  })

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, i) => (
              <Fragment key={crumb.href}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  )
}

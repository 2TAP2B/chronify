"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ThemePicker } from "@/components/theme-picker";

/** Theme section, collapsed by default (DOM stays mounted but hidden). */
export function ThemeCard() {
  const t = useTranslations("profile");
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger
            className="flex w-full items-center justify-between text-left"
            aria-expanded={open}
          >
            <div>
              <CardTitle className="group">{t("appearance")}</CardTitle>
              <CardDescription>{t("appearanceHint")}</CardDescription>
            </div>
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className={`border-t ${open ? "bg-muted/20" : ""}`}>
            <div className="py-4">
              <ThemePicker />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

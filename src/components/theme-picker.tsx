"use client"

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColorScheme } from "@/components/providers";

const STORAGE_KEY = "puku-color-scheme";

type ThemeOption = {
  id: string;
  label: string;
  swatch: string;
  colorScheme: ColorScheme;
  mode: "light" | "dark";
};

const THEMES: ThemeOption[] = [
  {
    id: "default-light",
    label: "defaultLight",
    swatch: "bg-blue-500",
    colorScheme: "default",
    mode: "light",
  },
  {
    id: "default-dark",
    label: "defaultDark",
    swatch: "bg-zinc-800",
    colorScheme: "default",
    mode: "dark",
  },
  {
    id: "mauve-light",
    label: "mauveLight",
    swatch: "bg-purple-500",
    colorScheme: "mauve",
    mode: "light",
  },
  {
    id: "mauve-dark",
    label: "mauveDark",
    swatch: "bg-purple-900",
    colorScheme: "mauve",
    mode: "dark",
  },
  {
    id: "catppuccin-frappe",
    label: "frappe",
    swatch: "bg-[#ca9ee6]",
    colorScheme: "catppuccin-frappe",
    mode: "dark",
  },
  {
    id: "catppuccin-macchiato",
    label: "macchiato",
    swatch: "bg-[#c6a0f6]",
    colorScheme: "catppuccin-macchiato",
    mode: "dark",
  },
  {
    id: "catppuccin-mocha",
    label: "mocha",
    swatch: "bg-[#cba6f7]",
    colorScheme: "catppuccin-mocha",
    mode: "dark",
  },
];

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");

  function apply(opt: ThemeOption) {
    localStorage.setItem(STORAGE_KEY, opt.colorScheme);
    window.dispatchEvent(new Event("puku-color-scheme-change"));
    setTheme(opt.mode);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {THEMES.map((opt) => {
        const active = theme === opt.mode && (localStorage.getItem(STORAGE_KEY) ?? "default") === opt.colorScheme;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => apply(opt)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors",
              active
                ? "border-primary ring-2 ring-primary/30"
                : "hover:bg-accent"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn("h-6 w-6 rounded-full", opt.swatch)} />
              {active && <Check className="h-4 w-4 text-primary" />}
            </div>
            <span className="text-xs font-medium">{t(opt.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

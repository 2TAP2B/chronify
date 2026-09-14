"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Check, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColorScheme } from "@/components/providers";
import { DEFAULT_COLOR_SCHEME } from "@/components/providers";

const STORAGE_KEY = "puku-color-scheme";

type Mode = "light" | "dark";

const SCHEMES: {
  colorScheme: ColorScheme;
  labelKey: string;
  swatchLight: string;
  swatchDark: string;
  modes: Mode[];
}[] = [
  {
    colorScheme: "default",
    labelKey: "defaultLight",
    swatchLight: "bg-blue-500",
    swatchDark: "bg-zinc-800",
    modes: ["light", "dark"],
  },
  {
    colorScheme: "mauve",
    labelKey: "mauveLight",
    swatchLight: "bg-purple-500",
    swatchDark: "bg-[#2a2035]",
    modes: ["light", "dark"],
  },
  {
    colorScheme: "dracula",
    labelKey: "draculaLight",
    swatchLight: "bg-[#bd93f9]",
    swatchDark: "bg-[#44475a]",
    modes: ["light", "dark"],
  },
  {
    colorScheme: "amethyst",
    labelKey: "amethystLight",
    swatchLight: "bg-[#8a79ab]",
    swatchDark: "bg-[#a995c9]",
    modes: ["light", "dark"],
  },
  {
    colorScheme: "pastel-dreams",
    labelKey: "pastelDreams",
    swatchLight: "bg-[#a78bfa]",
    swatchDark: "bg-[#c0aafd]",
    modes: ["light", "dark"],
  },
  {
    colorScheme: "catppuccin-frappe",
    labelKey: "frappe",
    swatchLight: "bg-[#ca9ee6]",
    swatchDark: "bg-[#626880]",
    modes: ["dark"],
  },
  {
    colorScheme: "catppuccin-macchiato",
    labelKey: "macchiato",
    swatchLight: "bg-[#c6a0f6]",
    swatchDark: "bg-[#494d64]",
    modes: ["dark"],
  },
  {
    colorScheme: "catppuccin-mocha",
    labelKey: "mocha",
    swatchLight: "bg-[#cba6f7]",
    swatchDark: "bg-[#6c7086]",
    modes: ["dark"],
  },
];

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const [scheme, setScheme] = useState<ColorScheme | "default">("default");

  // Read the persisted scheme after mount — avoids next-themes/localStorage
  // hydration mismatches.
  useEffect(() => {
    const onSync = () =>
      setScheme((localStorage.getItem(STORAGE_KEY) as ColorScheme | null) ?? "default");
    onSync();
    window.addEventListener("puku-color-scheme-change", onSync);
    return () => window.removeEventListener("puku-color-scheme-change", onSync);
  }, []);

  function apply(colorScheme: ColorScheme, mode: Mode) {
    localStorage.setItem(STORAGE_KEY, colorScheme);
    window.dispatchEvent(new Event("puku-color-scheme-change"));
    setTheme(mode);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 xl:max-w-xl">
      {SCHEMES.map((s) => {
        const activeScheme = scheme === s.colorScheme;
        const isFactoryDefault = s.colorScheme === DEFAULT_COLOR_SCHEME;
        return (
          <div
            key={s.colorScheme}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2",
              activeScheme ? "border-primary/60 bg-primary/5" : "",
              s.modes.length === 2 ? "" : ""
            )}
          >
            {/* Mode swatches double as a click target. */}
            <div className="flex shrink-0 items-center gap-1.5">
              {s.modes.map((mode) => {
                const active = activeScheme && theme === mode;
                return (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => apply(s.colorScheme, mode)}
                    aria-pressed={active}
                    aria-label={mode === "light" ? t("modeLight") : t("modeDark")}
                    title={mode === "light" ? t("modeLight") : t("modeDark")}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110",
                      mode === "light" ? s.swatchLight : s.swatchDark,
                      active && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    )}
                  >
                    {active && <Check className="size-3.5 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {t(s.labelKey)}
              {isFactoryDefault && (
                <span className="ml-1.5 rounded bg-muted px-1 py-0.5 align-middle text-[10px] font-normal text-muted-foreground">
                  {t("factoryDefault")}
                </span>
              )}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {s.modes.map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => apply(s.colorScheme, mode)}
                  aria-pressed={activeScheme && theme === mode}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                    activeScheme && theme === mode
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {mode === "light" ? <Sun className="size-3" /> : <Moon className="size-3" />}
                  {mode === "light" ? t("modeLight") : t("modeDark")}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

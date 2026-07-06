"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

export type ColorScheme = "default" | "mauve";

const STORAGE_KEY = "puku-color-scheme";

function ColorSchemeSync() {
  useEffect(() => {
    const apply = () => {
      const scheme = (localStorage.getItem(STORAGE_KEY) as ColorScheme | null) ?? "default";
      if (scheme === "default") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", scheme);
      }
    };
    apply();
    window.addEventListener("puku-color-scheme-change", apply);
    return () => window.removeEventListener("puku-color-scheme-change", apply);
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      themes={["light", "dark"]}
    >
      <ColorSchemeSync />
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}

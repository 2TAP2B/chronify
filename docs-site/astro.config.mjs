import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

const isProd = process.env.CI === "true";

export default defineConfig({
  site: "https://2tap2b.github.io",
  base: "/chronify",
  output: "static",
  trailingSlash: "ignore",
  integrations: [
    starlight({
      title: "Chronify",
      description: "Zeiterfassung für kleine Teams — Setup, Betrieb und Referenz",
      defaultLocale: "de",
      favicon: "/favicon.svg",
      sidebar: [
        {
          label: "Einführung",
          items: ["getting-started", "install"],
        },
        {
          label: "Betrieb",
          items: ["overview", "security", "operations", "kiosk"],
        },
        {
          label: "Referenz",
          items: ["reference/schema", "reference/api", "reference/env"],
        },
      ],
    }),
  ],
});

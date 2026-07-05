import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3001";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: true,
      },
});

// Note: if dev server is already running, playwright requires the
// webServer block to be omitted entirely (reuseExistingServer is not
// honored when the port is already taken). Set E2E_BASE_URL to skip it.


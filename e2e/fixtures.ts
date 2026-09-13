import { test as base, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@puku.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

async function login(page: Page, email: string, password: string) {
  await page.goto("/de/login");
  await page.getByLabel(/e-mail|email/i).fill(email);
  await page.getByLabel(/passwort|password/i).fill(password);
  await page.getByRole("button", { name: /anmelden|sign in|login/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

// Opens a <DatePicker> trigger and clicks the target day inside the popover
// calendar (react-day-picker marks day buttons with data-day="D.M.YYYY").
async function pickDate(page: Page, triggerId: string, isoDate: string) {
  await page.locator(`#${triggerId}`).click();
  const [year, month, day] = isoDate.split("-").map(Number);
  // Radix keeps closed popovers mounted, so scope to the open one.
  const popover = page.locator('[role="dialog"][data-state="open"]');
  const dayButton = popover.locator(`button[data-day="${day}.${month}.${year}"]`);
  for (let i = 0; i < 3 && (await dayButton.count()) === 0; i++) {
    await popover.locator('button[aria-label="Go to the Next Month"]').click();
  }
  await dayButton.click();
}

export const test = base.extend<{
  adminPage: Page;
  pickDate: (triggerId: string, isoDate: string) => Promise<void>;
}>({
  adminPage: async ({ page }, use) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await use(page);
  },
  pickDate: async ({ page }, use) => {
    await use((triggerId, isoDate) => pickDate(page, triggerId, isoDate));
  },
});

export { expect };

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

async function fillDateInput(page: Page, selector: string, isoDate: string) {
  await page.locator(selector).evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!;
    setter.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, isoDate);
}

export const test = base.extend<{
  adminPage: Page;
  fillDate: (selector: string, isoDate: string) => Promise<void>;
}>({
  adminPage: async ({ page }, use) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await use(page);
  },
  fillDate: async ({ page }, use) => {
    await use((selector, isoDate) => fillDateInput(page, selector, isoDate));
  },
});

export { expect };

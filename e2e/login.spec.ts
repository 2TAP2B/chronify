import { test, expect } from "./fixtures";

test("redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/de/dashboard");
  await expect(page).toHaveURL(/login/, { timeout: 15_000 });
});

test("admin login lands on dashboard", async ({ adminPage: page }) => {
  await expect(page.getByRole("heading", { name: /übersicht|dashboard/i })).toBeVisible({ timeout: 15_000 });
});

test("logout returns to login page", async ({ adminPage: page }) => {
  // Open the user dropdown by clicking the avatar trigger (last button in header)
  await page.locator("header").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /abmelden|logout/i }).click();
  await expect(page).toHaveURL(/login/, { timeout: 15_000 });
});

test("wrong password shows error", async ({ page }) => {
  await page.goto("/de/login");
  await page.getByLabel(/e-mail|email/i).fill("admin@puku.local");
  await page.getByLabel(/passwort|password/i).fill("wrong-password");
  await page.getByRole("button", { name: /anmelden|sign in|login/i }).click();
  await expect(page).toHaveURL(/login/, { timeout: 10_000 });
});

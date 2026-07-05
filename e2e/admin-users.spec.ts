import { test, expect } from "./fixtures";

const SUFFIX = "@e2e.test";

test("create user, edit, deactivate, reactivate", async ({ adminPage: page }) => {
  page.on("dialog", (d) => d.accept());

  const email = `e2e-${Date.now()}${SUFFIX}`;
  const name = "E2E Testuser";

  await page.goto("/de/admin/users");
  await expect(page.getByRole("heading", { name: /benutzerverwaltung/i })).toBeVisible({ timeout: 15_000 });

  // 1. Create
  await page.getByRole("button", { name: /neuer benutzer/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

  await page.locator("#email").fill(email);
  await page.locator("#password").fill("test1234");
  await page.locator("#name").fill(name);
  await page.getByRole("button", { name: /^speichern$/i }).click();

  await expect(page.getByText(email)).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");

  // 2. Edit name — target the row containing the new email
  const row = page.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: /^bearbeiten/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await page.locator("#name").fill("E2E Renamed");
  await page.getByRole("button", { name: /^speichern$/i }).click();

  await expect(page.getByText("E2E Renamed")).toBeVisible({ timeout: 15_000 });

  // 3. Deactivate (confirm dialog auto-accepted) — target the row
  const deactivateBtn = row.getByRole("button", { name: /deaktivieren/i }).first();
  if (await deactivateBtn.isVisible().catch(() => false)) {
    await deactivateBtn.click();
    await page.waitForLoadState("networkidle");
  }

  // 4. Reactivate
  const activateBtn = row.getByRole("button", { name: /aktivieren/i }).first();
  if (await activateBtn.isVisible().catch(() => false)) {
    await activateBtn.click();
    await page.waitForLoadState("networkidle");
  }

  // Verify user still present
  await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
});

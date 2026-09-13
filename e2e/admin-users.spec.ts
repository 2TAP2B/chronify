import { test, expect } from "./fixtures";

const SUFFIX = "@e2e.test";

test("create user, edit, deactivate, reactivate", async ({ adminPage: page }) => {
  const email = `e2e-${Date.now()}${SUFFIX}`;
  const initialName = "E2E Testuser";
  const renamed = "E2E Renamed";

  await page.goto("/de/admin/users");
  await expect(page.getByRole("heading", { name: /benutzerverwaltung/i })).toBeVisible({
    timeout: 15_000,
  });

  // 1. Create
  await page.getByRole("button", { name: /neuer benutzer/i }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog).toBeVisible({ timeout: 5_000 });
  await createDialog.locator("#email").fill(email);
  await createDialog.locator("#password").fill("test1234");
  await createDialog.locator("#name").fill(initialName);
  await createDialog.getByRole("button", { name: /^speichern$/i }).click();

  await expect(page.getByText(email)).toBeVisible({ timeout: 15_000 });

  const row = page.getByRole("row").filter({ hasText: email });

  // 2. Rename via the row action menu
  await row.getByRole("button", { name: /^aktionen$/i }).click();
  await page.getByRole("menuitem", { name: /^bearbeiten$/i }).click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toBeVisible({ timeout: 10_000 });
  await editDialog.locator("#name").fill(renamed);
  await editDialog.getByRole("button", { name: /^speichern$/i }).click();

  await expect(page.getByRole("row").filter({ hasText: email }).getByText(renamed)).toBeVisible({
    timeout: 15_000,
  });

  // 3. Deactivate (custom confirm dialog, not a native one)
  await row.getByRole("button", { name: /^aktionen$/i }).click();
  await page.getByRole("menuitem", { name: /^deaktivieren$/i }).click();
  const confirmDialog = page.getByRole("alertdialog");
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
  await confirmDialog.getByRole("button", { name: /^deaktivieren$/i }).click();
  await expect(row.getByText("Inaktiv")).toBeVisible({ timeout: 15_000 });

  // 4. Reactivate
  await row.getByRole("button", { name: /^aktionen$/i }).click();
  await page.getByRole("menuitem", { name: /^aktivieren$/i }).click();
  await expect(row.getByText("Aktiv", { exact: true })).toBeVisible({ timeout: 15_000 });
});

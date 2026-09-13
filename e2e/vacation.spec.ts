import { test, expect } from "./fixtures";

function nextMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

test("submit vacation request, then admin approves it", async ({ adminPage: page, pickDate }) => {
  const from = nextMonday();
  const to = new Date(from);
  to.setDate(to.getDate() + 4);

  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`;
  const fromLabel = `${String(from.getDate()).padStart(2, "0")}.${String(from.getMonth() + 1).padStart(2, "0")}.${from.getFullYear()}`;

  await page.goto("/de/vacation");
  await expect(page.getByRole("heading", { name: /^urlaub/i })).toBeVisible({
    timeout: 15_000,
  });

  await pickDate("from", fromStr);
  await pickDate("to", toStr);
  await page.locator("#note").fill("E2E: " + fromStr);
  await page.getByRole("button", { name: /antrag einreichen/i }).click();

  await expect(page.getByRole("cell", { name: fromLabel })).toBeVisible({
    timeout: 15_000,
  });

  // Approve as admin
  await page.goto("/de/admin/vacation-approvals");
  await expect(page.getByRole("heading", { name: /^urlaub/i })).toBeVisible({
    timeout: 15_000,
  });

  const approveButton = page.getByRole("button", { name: /^genehmigen$/i }).first();
  await expect(approveButton).toBeVisible({ timeout: 15_000 });
  await approveButton.click();

  const confirmDialog = page.getByRole("alertdialog");
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
  await confirmDialog.getByRole("button", { name: /^genehmigen$/i }).click();
  await expect(confirmDialog).toBeHidden({ timeout: 15_000 });

  // The approved request is no longer pending and shows as approved for the employee
  await page.goto("/de/vacation");
  const request = page.getByRole("row").filter({ hasText: fromLabel });
  await expect(request.getByText(/genehmigt/i)).toBeVisible({ timeout: 15_000 });
});

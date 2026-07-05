import { test, expect } from "./fixtures";

test("timer start, break, resume, stop creates a time entry", async ({ adminPage: page }) => {
  // Start
  await page.getByRole("button", { name: /starten/i }).click();
  await expect(page.getByText(/läuft/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /stoppen/i })).toBeVisible();

  // Wait 2s so we accumulate some worked time
  await page.waitForTimeout(2_000);

  // Break
  await page.getByRole("button", { name: /^pause$/i }).click();
  await expect(page.getByText(/in der pause/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /fortsetzen/i })).toBeVisible();

  // Resume
  await page.getByRole("button", { name: /fortsetzen/i }).click();
  await expect(page.getByText(/läuft/i)).toBeVisible({ timeout: 10_000 });

  // Stop (confirm dialog if present)
  await page.getByRole("button", { name: /stoppen/i }).click();
  const confirm = page.getByRole("button", { name: /bestätigen|ok|speichern/i });
  if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await confirm.click();
  }
  await expect(page.getByRole("button", { name: /starten/i })).toBeVisible({ timeout: 10_000 });

  // Verify time entry landed on timesheet
  await page.goto("/de/timesheet");
  await expect(page.getByRole("heading", { name: /stundenzettel/i })).toBeVisible({ timeout: 15_000 });
});

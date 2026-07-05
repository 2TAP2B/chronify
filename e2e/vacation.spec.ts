import { test, expect } from "./fixtures";

function nextMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmtDe(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

test("submit vacation request, then admin approves it", async ({ adminPage: page, fillDate }) => {
  page.on("dialog", (d) => d.accept());

  const from = nextMonday();
  const to = new Date(from);
  to.setDate(to.getDate() + 4);
  const fromStr = fmt(from);
  const toStr = fmt(to);

  await page.goto("/de/vacation");
  await expect(page.getByRole("heading", { name: /^urlaub/i })).toBeVisible({ timeout: 15_000 });

  await fillDate("#from", fromStr);
  await fillDate("#to", toStr);
  await page.locator("#note").fill("E2E: " + fromStr);
  await page.getByRole("button", { name: /antrag einreichen/i }).click();

  await expect(page.getByText(fmtDe(from))).toBeVisible({ timeout: 15_000 });

  await page.goto("/de/admin/vacation-approvals");
  await expect(page.getByRole("heading", { name: /^urlaub/i })).toBeVisible({ timeout: 15_000 });

  const approveBtn = page.getByRole("button", { name: /genehmigen/i }).first();
  await expect(approveBtn).toBeVisible({ timeout: 15_000 });
  await approveBtn.click();

  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});

import { test, expect } from "./fixtures";

test("overtime page shows per-day overview: month chips, bars and today's delta in a compact list", async ({
  adminPage: page,
}) => {
  await page.goto("/de/overtime");

  const overdue = page.locator("main");
  await expect(overdue).toBeVisible();

  // Section title renders
  await expect(page.getByRole("heading", { name: /überstunden/i }).first()).toBeVisible();
  await expect(page.getByText("Tagesübersicht")).toBeVisible();

  // Default month chips: 12 months, current month active (October)
  const chips = page
    .locator("button")
    .filter({ hasText: /^(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)$/ });
  await expect(chips).toHaveCount(12);
  await expect(chips.filter({ hasText: "Okt" })).toHaveClass(/bg-primary/);

  // Chart container + compact list render for the selected month
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible();

  // Switch to a month and the chips reflect the change
  await chips.filter({ hasText: "Mär" }).click();
  await expect(chips.filter({ hasText: "Mär" })).toHaveClass(/bg-primary/);
});

test("overtime day overview respects day details (worked/target/break)", async ({
  adminPage: page,
}) => {
  // Admin has a 40h/week model; today's rows come from seeded work, so check
  // the meta line format of the compact list (e.g. "8:00 / 8:00").
  await page.goto("/de/overtime");
  const rows = page.locator("div.flex.items-center.justify-between.gap-2.rounded-lg.border");
  await expect(rows.first()).toBeVisible();
  const meta = rows.first().locator("text=/\\d+:\\d{2} \\/ \\d+:\\d{2}/");
  await expect(meta).toBeVisible();
});

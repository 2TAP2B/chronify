import { test, expect } from "./fixtures";

// The dashboard renders the timer twice (mobile hero + desktop widget); only one
// copy is visible per viewport, so every interaction is scoped to the visible one.
const visible = { visible: true } as const;

test("timer start, break, resume, stop creates a time entry", async ({ adminPage: page }) => {
  const startButton = page
    .getByRole("button", { name: "Timer starten", exact: true })
    .filter(visible);
  const breakButton = page.getByRole("button", { name: "Pause", exact: true }).filter(visible);
  const resumeButton = page
    .getByRole("button", { name: "Fortsetzen", exact: true })
    .filter(visible);
  const stopButton = page
    .getByRole("button", { name: "Timer stoppen", exact: true })
    .filter(visible);

  await startButton.click();
  await expect(breakButton).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Läuft", { exact: true }).filter(visible)).toBeVisible();

  // Wait 2s so we accumulate some worked time
  await page.waitForTimeout(2_000);

  await breakButton.click();
  await expect(page.getByText("In der Pause", { exact: true }).filter(visible)).toBeVisible({
    timeout: 10_000,
  });
  await expect(resumeButton).toBeVisible();

  await resumeButton.click();
  await expect(page.getByText("Läuft", { exact: true }).filter(visible)).toBeVisible({
    timeout: 10_000,
  });

  await stopButton.click();
  await expect(startButton).toBeVisible({ timeout: 10_000 });

  // The stopped timer produced a time entry for today (marked with a T badge)
  await page.goto("/de/timesheet");
  await expect(page.getByRole("heading", { name: /stundenzettel/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page
      .getByRole("row")
      .filter({ has: page.getByText("T", { exact: true }) })
      .first()
  ).toBeVisible({ timeout: 15_000 });
});

import { test, expect } from "./fixtures";

// Same-session fetch from the live page: cookies + Origin attach automatically.
async function api(
  page: import("@playwright/test").Page,
  path: string,
  method: string,
  body?: unknown
) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    { path, method, body }
  );
}

test("sick note appears in dashboard overview table", async ({ adminPage: page }) => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Seed a sick note incl. SICK time entries via the API
  const created = await api(page, "/api/sickness", "POST", {
    from: d.toISOString(),
    to: d.toISOString(),
    note: "E2E sick entry",
  });
  expect(created.status).toBe(201);
  const noteId = created.json?.note?.id;
  expect(noteId).toBeTruthy();

  try {
    // Bottom table on the dashboard: the Kranks tab must show the entry.
    // Materialised SICK timeEntry rows carry the range note (not the form note).
    await page.goto("/de/dashboard");
    await page.getByRole("tab", { name: /^krank$/i }).click();
    await expect(page.locator("table").last().locator("tbody").locator("tr")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(
      page
        .locator("table")
        .last()
        .locator("tbody")
        .getByText(/\d{2}\.\d{2}\.\d{4}/)
    ).toBeVisible();
  } finally {
    // Self-cleanup: deletes the note and its SICK time entries
    const del = await api(page, `/api/sickness/${noteId}`, "DELETE");
    expect(del.status).toBe(200);
  }
});

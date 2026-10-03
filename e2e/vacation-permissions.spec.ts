import { test, expect, login } from "./fixtures";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function nextMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Always a Monday of the previous week (strictly in the past, independent of today's weekday)
function lastWeekMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7 || 7));
  return d;
}

// Same-session fetch from the live page: cookies + Origin are attached by the
// browser, so CSRF passes and the request runs as the logged-in user.
async function api(
  page: import("@playwright/test").Page,
  path: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<{
  status: number;
  json: { code?: string; error?: string; request?: { id: string } } | null;
}> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json().catch(() => null)) as {
        code?: string;
        error?: string;
        request?: { id: string };
      } | null;
      return { status: res.status, json };
    },
    { path, method, body }
  );
}

test("employee has no admin vacation features", async ({ adminPage: page }, testInfo) => {
  const empEmail = `e2e-perm-${Date.now()}-${testInfo.workerIndex}@e2e.test`;
  const empPassword = "perm1234a";
  const empChangedPassword = "perm9876z";
  let empNeedsPasswordChange = true;

  // Employee login (first login goes through the mandatory password change)
  async function switchToEmployee() {
    await page.context().clearCookies();
    const password = empNeedsPasswordChange ? empPassword : empChangedPassword;
    await page.goto("/de/login");
    await page.getByLabel(/e-mail|email/i).fill(empEmail);
    await page.getByLabel(/passwort|password/i).fill(password);
    await page.getByRole("button", { name: /^(anmelden|sign in|log in)$/i }).click();
    if (empNeedsPasswordChange) {
      await page.waitForURL(/change-password/, { timeout: 15_000 });
      await page.locator("#current").fill(empPassword);
      await page.locator("#new").fill(empChangedPassword);
      await page.locator("#confirm").fill(empChangedPassword);
      await page.getByRole("button", { name: /passwort ändern|change password/i }).click();
      await page.waitForURL(/dashboard/, { timeout: 15_000 });
      empNeedsPasswordChange = false;
    } else {
      await page.waitForURL(/dashboard/, { timeout: 15_000 });
    }
  }

  const adminLogin = async () => {
    await page.context().clearCookies();
    await login(page, "admin@puku.local", "admin123");
  };

  // 1. Admin creates the employee account
  await page.goto("/de/admin/users");
  await page.getByRole("button", { name: /neuer benutzer/i }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog).toBeVisible({ timeout: 10_000 });
  await createDialog.locator("#email").fill(empEmail);
  await createDialog.locator("#password").fill(empPassword);
  await createDialog.locator("#name").fill("E2E Urlauber");
  await createDialog.getByRole("button", { name: /^speichern$/i }).click();
  await expect(page.getByText(empEmail)).toBeVisible({ timeout: 15_000 });

  // 2. Admin creates an own pending request (used as foreign-owned probe)
  const futureBase = nextMonday();
  const adminReq = await api(page, "/api/vacation", "POST", {
    from: new Date(isoDate(futureBase) + "T00:00:00Z").toISOString(),
    to: new Date(isoDate(futureBase) + "T00:00:00Z").toISOString(),
    note: "e2e-perm admin-owned",
  });
  expect(adminReq.status).toBe(201);
  const adminReqId = adminReq.json?.request?.id;
  expect(adminReqId).toBeTruthy();

  // 3. Switch into the employee session
  await switchToEmployee();

  // 4. Employee submits a future and a past vacation request via the API
  const pastFrom = new Date(isoDate(lastWeekMonday()) + "T00:00:00Z");
  const pastTo = new Date(pastFrom);
  pastTo.setDate(pastTo.getDate() + 2);
  const pastReq = await api(page, "/api/vacation", "POST", {
    from: pastFrom.toISOString(),
    to: pastTo.toISOString(),
    note: "e2e-perm past",
  });
  expect(pastReq.status).toBe(201);
  const pastReqId = pastReq.json?.request?.id;
  expect(pastReqId).toBeTruthy();

  const futureReq = await api(page, "/api/vacation", "POST", {
    from: new Date(isoDate(futureBase) + "T00:00:00Z").toISOString(),
    to: new Date(isoDate(futureBase) + "T00:00:00Z").toISOString(),
    note: "e2e-perm future",
  });
  expect(futureReq.status).toBe(201);
  const futureReqId = futureReq.json?.request?.id;
  expect(futureReqId).toBeTruthy();

  // 5. Guard matrix: the employee may not use admin-only actions
  const approveSelf = await api(page, `/api/vacation/${futureReqId}/approve`, "POST", {});
  expect(approveSelf.status).toBe(403);
  expect(approveSelf.json?.code).toBe("FORBIDDEN");

  const approveForeign = await api(page, `/api/vacation/${adminReqId}/approve`, "POST", {});
  expect(approveForeign.status).toBe(403);
  expect(approveForeign.json?.code).toBe("FORBIDDEN");

  const rejectForeign = await api(page, `/api/vacation/${adminReqId}/reject`, "POST", {});
  expect(rejectForeign.status).toBe(403);
  expect(rejectForeign.json?.code).toBe("FORBIDDEN");

  const cancelForeign = await api(page, `/api/vacation/${adminReqId}/cancel`, "POST", {});
  expect(cancelForeign.status).toBe(403);
  expect(cancelForeign.json?.code).toBe("FORBIDDEN");

  // Regeneration leave is only available to users with the flag; this
  // employee does not have it -> quota rejected.
  const createRegeneration = await api(page, "/api/vacation", "POST", {
    from: new Date(isoDate(nextMonday()) + "T00:00:00Z").toISOString(),
    to: new Date(isoDate(nextMonday()) + "T00:00:00Z").toISOString(),
    kind: "REGENERATION",
  });
  expect(createRegeneration.status).toBe(403);
  expect(createRegeneration.json?.code).toBe("NO_REGENERATION");

  const createForOther = await api(page, "/api/vacation", "POST", {
    from: new Date(isoDate(nextMonday()) + "T00:00:00Z").toISOString(),
    to: new Date(isoDate(nextMonday()) + "T00:00:00Z").toISOString(),
    userId: "someone-else",
  });
  expect(createForOther.status).toBe(403);
  expect(createForOther.json?.code).toBe("FORBIDDEN");

  const listOther = await api(page, "/api/vacation?userId=someone-else", "GET");
  expect(listOther.status).toBe(403);
  expect(listOther.json?.code).toBe("FORBIDDEN");

  // 6. Admin approves both employee requests
  await adminLogin();
  await page.goto("/de/admin/vacation-approvals");
  const empPending = page.getByRole("row").filter({ hasText: empEmail });
  await expect(empPending).toHaveCount(2, { timeout: 15_000 });
  for (const note of ["e2e-perm past", "e2e-perm future"]) {
    const row = page.getByRole("row").filter({ hasText: note }).first();
    await row.getByRole("button", { name: /^genehmigen$/i }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: /^genehmigen$/i }).click();
    // Approval actions reload the page before removing the row; waiting for the
    // row to leave the pending list avoids racing that reload in the next step.
    await expect(row).toHaveCount(0, { timeout: 15_000 });
  }

  // 7. Employee session again: approved-past is protected
  await switchToEmployee();
  await page.goto("/de/vacation");
  const pastRow = page.getByRole("row").filter({ hasText: "e2e-perm past" });
  await expect(pastRow.getByText(/genehmigt/i)).toBeVisible({ timeout: 15_000 });
  // Past approved vacation: no cancel action rendered for the owner
  await expect(pastRow.locator("button")).toHaveCount(0);

  const futureRow = page.getByRole("row").filter({ hasText: "e2e-perm future" });
  await expect(futureRow.getByText(/genehmigt/i)).toBeVisible({ timeout: 15_000 });
  // Approved future vacation stays cancellable by the owner (by design)
  await expect(futureRow.locator("button")).toHaveCount(1);

  // Direct API attempt on the past approved request must fail
  const cancelPast = await api(page, `/api/vacation/${pastReqId}/cancel`, "POST", {});
  expect(cancelPast.status).toBe(403);
  expect(cancelPast.json?.code).toBe("APPROVED_PAST");

  // The future approved request can be cancelled by the owner
  const cancelFuture = await api(page, `/api/vacation/${futureReqId}/cancel`, "POST", {});
  expect(cancelFuture.status).toBe(200);
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "e2e-perm future" }).first()).toContainText(
    /storniert/i
  );

  // 8. Admin pages are out of reach (middleware redirect)
  await page.goto("/de/admin/vacation-approvals");
  await expect(page).toHaveURL(/\/de\/dashboard/);

  // 9. Cleanup: admin cancels the foreign-owned pending probe
  await adminLogin();
  const adminSelfCancel = await api(page, `/api/vacation/${adminReqId}/cancel`, "POST", {});
  expect(adminSelfCancel.status).toBe(200);
});

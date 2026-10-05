import { test, expect, login } from "./fixtures";
import type { Page } from "@playwright/test";

const EMP_PASSWORD = "employee-password-1";
const EMP_CHANGED_PASSWORD = "employee-password-2";

type ApiResult = { status: number; json: Record<string, unknown> | null };

async function api(
  page: Page,
  path: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<ApiResult> {
  return page.evaluate(
    async ({ path: p, method: m, body: b }) => {
      const res = await fetch(p, {
        method: m,
        headers: b ? { "Content-Type": "application/json" } : undefined,
        body: b ? JSON.stringify(b) : undefined,
      });
      const json: Record<string, unknown> | null = await res.json().catch(() => null);
      return { status: res.status, json };
    },
    { path, method, body }
  );
}

async function switchTo(page: Page, email: string, needsPasswordChange: boolean) {
  await page.context().clearCookies();
  await page.goto("/de/login");
  await page.getByLabel(/e-mail|email/i).fill(email);
  await page.getByLabel(/passwort|password/i).fill(EMP_PASSWORD);
  await page.getByRole("button", { name: /^(anmelden|sign in|log in)$/i }).click();
  if (needsPasswordChange) {
    await page.waitForURL(/change-password/, { timeout: 15_000 });
    await page.locator("#current").fill(EMP_PASSWORD);
    await page.locator("#new").fill(EMP_CHANGED_PASSWORD);
    await page.locator("#confirm").fill(EMP_CHANGED_PASSWORD);
    await page.getByRole("button", { name: /passwort ändern|change password/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
  } else {
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
  }
}

test("admin starts (backdated), inspects and stops another user's timer; employees stay locked out", async ({
  adminPage: page,
}) => {
  // Seed two employees (cleaned up by global-setup via @e2e.test emails)
  const empEmail = `remote-timer-${Date.now()}@e2e.test`;
  const empB = `remote-timer-b-${Date.now()}@e2e.test`;
  for (const [email, name] of [
    [empEmail, "Remote Timer A"],
    [empB, "Remote Timer B"],
  ]) {
    const res = await api(page, "/api/admin/users", "POST", {
      email,
      password: EMP_PASSWORD,
      name,
      role: "EMPLOYEE",
    });
    expect(res.status).toBe(201);
  }

  const list = await api(page, `/api/admin/users`, "GET");
  const users = (list.json as { users: { email: string; id: string }[] } | null)?.users ?? [];
  const empId = users.find((u) => u.email === empEmail)?.id;
  expect(empId).toBeTruthy();

  // 1. Backdated admin start for the employee (3 h ago)
  const backdated = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const start = await api(page, "/api/timer/start", "POST", { userId: empId, startAt: backdated });
  expect(start.status).toBe(200);
  expect((start.json as { active: boolean }).active).toBe(true);
  expect(new Date((start.json as { startedAt: string }).startedAt).getTime()).toBeLessThanOrEqual(
    new Date(backdated).getTime() + 1000
  );

  // 2. Admin sees the employee's running timer
  const status = await api(page, `/api/timer?userId=${empId}`, "GET");
  expect(status.status).toBe(200);
  expect((status.json as { active: boolean }).active).toBe(true);
  expect((status.json as { elapsedMs: number }).elapsedMs).toBeGreaterThan(0);

  // 3. Double start rejected
  const again = await api(page, "/api/timer/start", "POST", { userId: empId });
  expect(again.status).toBe(409);
  expect((again.json as { code?: string }).code).toBe("ALREADY_RUNNING");

  // 4. Admin stops the remote timer
  const stop = await api(page, "/api/timer/stop", "POST", { userId: empId });
  expect(stop.status).toBe(200);

  // 5. Employee cannot remote-control other users (start with userId / backdate)
  await switchTo(page, empEmail, true);
  const evilUserId = await api(page, "/api/timer/start", "POST", { userId: "other" });
  expect(evilUserId.status).toBe(403);
  const evilBackdate = await api(page, "/api/timer/start", "POST", {
    startAt: new Date(Date.now() - 3_600_000).toISOString(),
  });
  expect(evilBackdate.status).toBe(403);
  // Plain self-start without body still works for employees
  const selfStart = await api(page, "/api/timer/start", "POST");
  expect(selfStart.status).toBe(200);

  // 6. Employee cannot GET another user's timer state
  const foreign = await api(
    page,
    `/api/timer?userId=${empId === users[0].id ? users[1].id : users[0].id}`,
    "GET"
  );
  expect(foreign.status).toBe(403);
});

test("future-dated remote start is rejected", async ({ adminPage: page }) => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const res = await api(page, "/api/timer/start", "POST", {
    startAt: future,
  });
  expect(res.status).toBe(409);
  expect((res.json as { code?: string }).code).toBe("INVALID_START");
});

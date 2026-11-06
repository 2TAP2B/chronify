import "@/lib/load-env";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { addDaysUtc, toCalendarDate, zonedTimeToUtc } from "@/lib/datetime";
import { syncHolidaysForState } from "@/server/services/holidays";
import { computeYearOvertime } from "@/server/services/overtime";
import {
  approveVacationRequest,
  cancelVacationRequest,
  createVacationRequest,
} from "@/server/services/vacation";
import { createClosure, deleteClosure, updateChoice } from "@/server/services/business-closures";
import { runYearSetup } from "@/server/services/admin-year-setup";
import type { SessionUser } from "@/server/context";

/**
 * Deterministic overtime/vacation scenarios for the LOCAL dev database.
 *
 *   npm run scenarios:seed   — (re)creates the test users + a full year of data
 *   npm run scenarios:check  — recomputes balances via the real services and
 *                              compares them against the expected values below
 *
 * Expected values are derived from the scenario definition (the business
 * rules), never from the app's own formulas — a FAIL means the app disagrees
 * with the rules. Work entries cover the whole year; the app only counts days
 * before today, so `check` stays valid on any later day without re-seeding.
 */

const TZ = "Europe/Berlin";
const STATE = "DE_NW" as const;
const PREV_YEAR = 2025;
const YEAR = 2026;
const EMAIL_DOMAIN = "szenario.local";
const PASSWORD = "test1234";
const CLOSURE_NAME = "[Szenario] Brückentag nach Christi Himmelfahrt";
const CLOSURE_DAY = "2026-05-15"; // Friday after Ascension (14.05.2026)
/** Extra minutes per "overtime day"; the first 5 regular work days of each month get one. */
const EXTRA_MINUTES = 60;
const EXTRA_DAYS_PER_MONTH = 5;

/** Minutes per weekday Mon..Fri; weekends are always 0. */
type Week = [number, number, number, number, number];
type ModelDef = { from: string; to?: string; week: Week };

type EventDef =
  /** Full day off paid from overtime ("Überstunden abfeiern"). */
  | { kind: "overtimeDay"; date: string }
  /** Half day off paid from overtime; works `workMinutes` the other half. */
  | { kind: "overtimeHalfDay"; date: string; workMinutes: number }
  /**
   * Regular vacation from the entitlement, approved before the business closure
   * is created. `cancelAfterClosure`: an admin cancels it after the closure exists
   * (the employee then works those days). `createAfterClosure`: requested and
   * approved only after the closure exists.
   */
  | {
      kind: "vacation";
      from: string;
      to: string;
      cancelAfterClosure?: true;
      createAfterClosure?: true;
    }
  /** Half vacation day from the entitlement; works `workMinutes` the other half. */
  | { kind: "vacationHalfDay"; date: string; workMinutes: number };

type Scenario = {
  key: string;
  name: string;
  hireDate: string;
  models: ModelDef[];
  events: EventDef[];
  /** Employee switches the business-closure choice from vacation to overtime. */
  closureChoice: "VACATION" | "OVERTIME";
  /** Hand-calculated from the rules (see comments). */
  expected: {
    consumedOvertimeMinutes: Partial<Record<number, number>>;
    vacationDays: Partial<Record<number, number>>;
    /** Overtime debited via the closure day (choice OVERTIME): that day's model minutes. */
    closureOvertimeMinutes: number;
  };
};

const SCENARIOS: Scenario[] = [
  {
    key: "vollzeit",
    name: "Szenario Vollzeit 40h",
    hireDate: "2025-10-01",
    models: [{ from: "2025-10-01", week: [480, 480, 480, 480, 480] }],
    events: [
      { kind: "overtimeDay", date: "2025-12-19" }, // Fri 8h → 480 min from 2025 overtime
      { kind: "vacation", from: "2026-08-03", to: "2026-08-07" }, // Mon–Fri → 5 days
    ],
    closureChoice: "VACATION", // Fri 8h → 1 vacation day
    expected: {
      consumedOvertimeMinutes: { [PREV_YEAR]: 480, [YEAR]: 0 },
      vacationDays: { [YEAR]: 6 },
      closureOvertimeMinutes: 0,
    },
  },
  {
    key: "viertage",
    name: "Szenario 4-Tage-Woche 32h",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 480, 480, 0] }],
    events: [
      { kind: "vacation", from: "2026-03-16", to: "2026-03-20" }, // Mon–Fri, Fri = 0h → 4 days
      { kind: "overtimeDay", date: "2026-06-11" }, // Thu 8h → 480 min
    ],
    closureChoice: "VACATION", // Fri = 0h → closure consumes nothing
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 480 },
      vacationDays: { [YEAR]: 4 },
      closureOvertimeMinutes: 0,
    },
  },
  {
    key: "teilzeit",
    name: "Szenario Teilzeit 30h",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 240, 360, 240] }],
    events: [
      { kind: "overtimeDay", date: "2026-04-22" }, // Wed 4h → 240 min
      { kind: "overtimeHalfDay", date: "2026-07-13", workMinutes: 240 }, // Mon 8h/2 → 240 min
      { kind: "vacationHalfDay", date: "2026-09-10", workMinutes: 180 }, // Thu 6h → 0.5 days
    ],
    closureChoice: "OVERTIME", // Fri 4h → 240 min overtime, 0 vacation days
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 480 },
      vacationDays: { [YEAR]: 0.5 },
      closureOvertimeMinutes: 240,
    },
  },
  {
    key: "modellwechsel",
    name: "Szenario Modellwechsel 40h→30h",
    hireDate: "2026-01-01",
    models: [
      { from: "2026-01-01", to: "2026-06-30", week: [480, 480, 480, 480, 480] },
      { from: "2026-07-01", week: [360, 360, 360, 360, 360] },
    ],
    events: [
      { kind: "vacation", from: "2026-02-09", to: "2026-02-13" }, // 40h model → 5 days
      { kind: "overtimeDay", date: "2026-07-17" }, // Fri under 30h model → 360 min
    ],
    closureChoice: "VACATION", // 15.05. under 40h model → 1 day
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 360 },
      vacationDays: { [YEAR]: 6 },
      closureOvertimeMinutes: 0,
    },
  },
  {
    key: "ueberschneidung",
    name: "Szenario Urlaub überschneidet Schließtag",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 480, 480, 480] }],
    events: [
      // Mon–Fri, Thu 14.05. is a holiday → 4 days. The closure (Fri 15.05.)
      // is created later and lies inside this vacation: still 4 days in total.
      { kind: "vacation", from: "2026-05-11", to: "2026-05-15" },
    ],
    closureChoice: "VACATION",
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 0 },
      vacationDays: { [YEAR]: 4 },
      closureOvertimeMinutes: 0,
    },
  },
  {
    key: "storno",
    name: "Szenario Urlaub storniert nach Schließtag",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 480, 480, 480] }],
    events: [
      // Wed 13.05. + Fri 15.05. (Thu holiday), cancelled after the closure
      // exists: the closure day must stay vacation → 1 day, no overtime impact.
      { kind: "vacation", from: "2026-05-13", to: "2026-05-15", cancelAfterClosure: true },
    ],
    closureChoice: "VACATION",
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 0 },
      vacationDays: { [YEAR]: 1 },
      closureOvertimeMinutes: 0,
    },
  },
  {
    key: "nachschliesstag",
    name: "Szenario Urlaub nach Schließtag beantragt",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 480, 480, 480] }],
    events: [
      // Requested after the closure exists: Mon–Wed charge 3 days (Thu holiday),
      // Fri stays with the closure (1 day) → 4 days in total.
      { kind: "vacation", from: "2026-05-11", to: "2026-05-15", createAfterClosure: true },
    ],
    closureChoice: "VACATION",
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 0 },
      vacationDays: { [YEAR]: 4 },
      closureOvertimeMinutes: 0,
    },
  },
  {
    key: "abfeiernschliesstag",
    name: "Szenario Abfeiern am späteren Schließtag",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 480, 480, 480] }],
    events: [
      // Fri 15.05. taken off from overtime first; the closure created later
      // takes the day over: 8h overtime refunded, 1 vacation day charged.
      { kind: "overtimeDay", date: "2026-05-15" },
    ],
    closureChoice: "VACATION",
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 0 },
      vacationDays: { [YEAR]: 1 },
      closureOvertimeMinutes: 0,
    },
  },
];

// ---------------------------------------------------------------------------
// Plan (pure): which day gets which work entry
// ---------------------------------------------------------------------------

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const emailOf = (s: Scenario) => `${s.key}@${EMAIL_DOMAIN}`;

function modelOn(s: Scenario, date: Date): ModelDef | null {
  const key = iso(date);
  return s.models.find((m) => m.from <= key && (!m.to || key <= m.to)) ?? null;
}

function targetOn(s: Scenario, date: Date): number {
  const m = modelOn(s, date);
  const wd = date.getUTCDay();
  if (!m || wd === 0 || wd === 6) return 0;
  return m.week[wd - 1];
}

type PlannedDay = {
  date: Date;
  workMinutes: number;
  /** Expected overtime delta of this day in minutes. */
  deltaMinutes: number;
};

/** Org calendar for NRW: public holidays and the configured half days (24.12/31.12). */
type Calendar = { holidays: Set<string>; halfDays: Set<string> };

function buildPlan(s: Scenario, cal: Calendar): PlannedDay[] {
  const off = new Set<string>();
  const half = new Map<string, number>();
  for (const e of s.events) {
    if (e.kind === "overtimeDay") off.add(e.date);
    if (e.kind === "vacation" && !e.cancelAfterClosure) {
      for (let x = d(e.from); x <= d(e.to); x = addDaysUtc(x, 1)) off.add(iso(x));
    }
    if (e.kind === "overtimeHalfDay" || e.kind === "vacationHalfDay") {
      half.set(e.date, e.workMinutes);
    }
  }

  const plan: PlannedDay[] = [];
  const extrasByMonth = new Map<string, number>();
  for (let x = d(s.hireDate); x < d(`${YEAR + 1}-01-01`); x = addDaysUtc(x, 1)) {
    const key = iso(x);
    const target = targetOn(s, x);
    if (target === 0 || cal.holidays.has(key)) continue;
    if (cal.halfDays.has(key.slice(5))) {
      // 24.12/31.12 are half working days for the org: work the half, delta 0.
      plan.push({ date: x, workMinutes: Math.floor(target / 2), deltaMinutes: 0 });
      continue;
    }
    if (key === CLOSURE_DAY) {
      // Closure day: no work. With OVERTIME the missing target is the debit.
      plan.push({ date: x, workMinutes: 0, deltaMinutes: -s.expected.closureOvertimeMinutes });
      continue;
    }
    if (off.has(key)) continue;
    const halfWork = half.get(key);
    if (halfWork !== undefined) {
      // The other half is vacation/overtime → that half's target is covered.
      plan.push({ date: x, workMinutes: halfWork, deltaMinutes: 0 });
      continue;
    }
    const month = key.slice(0, 7);
    const extras = extrasByMonth.get(month) ?? 0;
    const extra = extras < EXTRA_DAYS_PER_MONTH ? EXTRA_MINUTES : 0;
    if (extra) extrasByMonth.set(month, extras + 1);
    plan.push({ date: x, workMinutes: target + extra, deltaMinutes: extra });
  }
  return plan;
}

/** Statutory break for a net work time (ArbZG §4). */
function breakFor(netMinutes: number): number {
  if (netMinutes > 9 * 60) return 45;
  if (netMinutes > 6 * 60) return 30;
  return 0;
}

async function loadCalendar(): Promise<Calendar> {
  const [rows, settings] = await Promise.all([
    db.publicHoliday.findMany({
      where: {
        federalState: STATE,
        date: { gte: d(`${PREV_YEAR}-01-01`), lt: d(`${YEAR + 1}-01-01`) },
      },
      select: { date: true },
    }),
    db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
  ]);
  const halfDays = new Set<string>();
  if (settings.heiligabendHalfDay) halfDays.add("12-24");
  if (settings.silvesterHalfDay) halfDays.add("12-31");
  return { holidays: new Set(rows.map((r) => iso(r.date))), halfDays };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function adminActor(): Promise<SessionUser> {
  const admin = await db.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No active admin — run `npm run db:setup` first.");
  return { id: admin.id, role: "ADMIN", name: admin.name, email: admin.email };
}

async function seed() {
  const actor = await adminActor();

  for (const year of [PREV_YEAR, YEAR]) {
    const r = await syncHolidaysForState(year, STATE);
    console.log(`✓ Feiertage ${STATE} ${year}: ${r.upserted}`);
  }
  const calendar = await loadCalendar();

  // Cleanup: reverse the closure for all users, then drop the test users.
  for (const c of await db.businessClosure.findMany({ where: { name: CLOSURE_NAME } })) {
    await deleteClosure({ actor, closureId: c.id });
  }
  const removed = await db.user.deleteMany({ where: { email: { endsWith: `@${EMAIL_DOMAIN}` } } });
  if (removed.count) console.log(`✓ ${removed.count} alte Szenario-User entfernt`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users = new Map<string, string>();
  for (const s of SCENARIOS) {
    const user = await db.user.create({
      data: {
        email: emailOf(s),
        passwordHash,
        name: s.name,
        firstName: "Szenario",
        lastName: s.key,
        role: "EMPLOYEE",
        federalState: STATE,
        timezone: TZ,
        hireDate: d(s.hireDate),
        vacationMailEnabled: false,
        sickMailEnabled: false,
        workingModels: {
          create: s.models.map((m) => ({
            validFrom: d(m.from),
            validTo: m.to ? d(m.to) : null,
            mondayMinutes: m.week[0],
            tuesdayMinutes: m.week[1],
            wednesdayMinutes: m.week[2],
            thursdayMinutes: m.week[3],
            fridayMinutes: m.week[4],
            weeklyTargetMinutes: m.week.reduce((a, b) => a + b, 0),
          })),
        },
      },
    });
    users.set(s.key, user.id);

    const plan = buildPlan(s, calendar);
    await db.timeEntry.createMany({
      data: plan
        .filter((p) => p.workMinutes > 0)
        .map((p) => {
          const [y, m, day] = iso(p.date).split("-").map(Number);
          const startAt = zonedTimeToUtc(y, m, day, 8, 0, TZ);
          const breakMinutes = breakFor(p.workMinutes);
          return {
            userId: user.id,
            date: p.date,
            startAt,
            endAt: new Date(startAt.getTime() + (p.workMinutes + breakMinutes) * 60_000),
            breakMinutes,
            type: "WORK" as const,
            source: "MANUAL" as const,
            note: "Szenario",
          };
        }),
    });
    console.log(`✓ ${s.name}: ${plan.filter((p) => p.workMinutes > 0).length} Arbeitstage`);
  }

  const toCancel: string[] = [];
  const request = async (userId: string, e: EventDef) => {
    const from = d(e.kind === "vacation" ? e.from : e.date);
    const to = d(e.kind === "vacation" ? e.to : e.date);
    const req = await createVacationRequest({
      actor,
      input: {
        from,
        to,
        targetUserId: userId,
        useOvertime: e.kind === "overtimeDay" || e.kind === "overtimeHalfDay",
        halfDay: e.kind === "overtimeHalfDay" || e.kind === "vacationHalfDay",
        note: "Szenario",
      },
    });
    await approveVacationRequest({ actor, requestId: req.id });
    if (e.kind === "vacation" && e.cancelAfterClosure) toCancel.push(req.id);
  };

  // Previous-year events, then the year rollover with carryover.
  for (const s of SCENARIOS) {
    for (const e of s.events.filter((x) => eventYear(x) === PREV_YEAR)) {
      await request(users.get(s.key)!, e);
    }
  }
  await runYearSetup({ actor, year: YEAR, carriedOverFromPrev: true });
  console.log(`✓ Jahreswechsel ${YEAR} mit Übertrag`);

  const afterClosure = (e: EventDef) => e.kind === "vacation" && e.createAfterClosure === true;
  for (const s of SCENARIOS) {
    for (const e of s.events.filter((x) => eventYear(x) === YEAR && !afterClosure(x))) {
      await request(users.get(s.key)!, e);
    }
  }

  const closure = await createClosure({
    actor,
    input: { from: d(CLOSURE_DAY), to: d(CLOSURE_DAY), name: CLOSURE_NAME },
  });
  for (const s of SCENARIOS) {
    for (const e of s.events.filter(afterClosure)) await request(users.get(s.key)!, e);
  }
  for (const s of SCENARIOS.filter((x) => x.closureChoice === "OVERTIME")) {
    await updateChoice({
      actor: { id: users.get(s.key)!, role: "EMPLOYEE" },
      closureId: closure.id,
      choice: "OVERTIME",
    });
  }
  for (const requestId of toCancel) {
    await cancelVacationRequest({ actor, requestId });
  }
  console.log(`✓ Schließtag ${CLOSURE_DAY} + Anträge genehmigt/storniert`);
  console.log(`\nLogin: <key>@${EMAIL_DOMAIN} / ${PASSWORD}`);
}

function eventYear(e: EventDef): number {
  return Number((e.kind === "vacation" ? e.from : e.date).slice(0, 4));
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

const fmt = (min: number) => {
  const sign = min < 0 ? "-" : "+";
  const abs = Math.abs(min);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
};

async function check(): Promise<boolean> {
  const calendar = await loadCalendar();
  const today = toCalendarDate(new Date(), TZ);
  let ok = true;

  for (const s of SCENARIOS) {
    const user = await db.user.findUnique({ where: { email: emailOf(s) } });
    if (!user) throw new Error(`${emailOf(s)} fehlt — erst \`npm run scenarios:seed\``);
    const plan = buildPlan(s, calendar).filter((p) => p.date < today);
    console.log(`\n${s.name} (${emailOf(s)})`);

    const rows: [string, string, string][] = [];
    const add = (label: string, expected: string, actual: string) =>
      rows.push([label, expected, actual]);

    let carry = 0;
    for (const year of [PREV_YEAR, YEAR]) {
      if (Number(s.hireDate.slice(0, 4)) > year) continue;
      const yearPlan = plan.filter((p) => p.date.getUTCFullYear() === year);
      const delta = yearPlan.reduce((sum, p) => sum + p.deltaMinutes, 0);
      const consumed = s.expected.consumedOvertimeMinutes[year] ?? 0;
      const balance = carry + delta - consumed;

      const { computation, days } = await computeYearOvertime({
        userId: user.id,
        year,
        timeZone: TZ,
      });
      const toMin = (ms: number) => Math.round(ms / 60_000);
      add(`${year} Übertrag`, fmt(carry), fmt(computation.carriedOverMinutes));
      add(`${year} Saldo Arbeitstage`, fmt(delta), fmt(toMin(computation.totalDeltaMs)));
      add(`${year} abgefeiert`, fmt(consumed), fmt(computation.consumedOvertimeMinutes));
      add(`${year} Überstundenkonto`, fmt(balance), fmt(toMin(computation.balanceMs)));
      for (let m = 0; m < 12; m++) {
        const exp = yearPlan
          .filter((p) => p.date.getUTCMonth() === m)
          .reduce((sum, p) => sum + p.deltaMinutes, 0);
        const act = toMin(computation.byMonth[m].deltaMs);
        if (exp !== act) add(`${year}-${String(m + 1).padStart(2, "0")} Monat`, fmt(exp), fmt(act));
      }

      // Per-day diagnostics: the first days whose delta disagrees with the plan.
      const expectedByDay = new Map(yearPlan.map((p) => [iso(p.date), p.deltaMinutes]));
      const actualByDay = new Map(days.map((x) => [iso(x.date), toMin(x.deltaMs)]));
      const keys = [...new Set([...expectedByDay.keys(), ...actualByDay.keys()])].sort();
      const wrong = keys.filter((k) => (expectedByDay.get(k) ?? 0) !== (actualByDay.get(k) ?? 0));
      for (const k of wrong.slice(0, 5)) {
        add(`  Tag ${k}`, fmt(expectedByDay.get(k) ?? 0), fmt(actualByDay.get(k) ?? 0));
      }
      if (wrong.length > 5) add(`  … ${wrong.length - 5} weitere Tage`, "", "");

      const vacationDays = s.expected.vacationDays[year];
      if (vacationDays !== undefined) {
        const ent = await db.vacationEntitlement.findUnique({
          where: { userId_year: { userId: user.id, year } },
        });
        add(`${year} Urlaubstage verbraucht`, String(vacationDays), String(ent?.consumedDays ?? 0));
      }
      carry = balance;
    }

    for (const [label, expected, actual] of rows) {
      const pass = expected === actual;
      if (!pass && expected !== "") ok = false;
      const mark = expected === "" ? "" : pass ? "OK  " : "FAIL";
      console.log(
        `  ${mark.padEnd(4)} ${label.padEnd(28)} soll ${expected.padStart(8)}  ist ${actual.padStart(8)}`
      );
    }
  }
  console.log(ok ? "\nAlle Szenarien OK." : "\nAbweichungen gefunden (FAIL).");
  return ok;
}

// ---------------------------------------------------------------------------

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^:/?]+)/)?.[1];
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1"].includes(host ?? "")) {
    throw new Error(`Refusing to run against non-local database (host: ${host ?? "?"}).`);
  }
}

async function main() {
  assertLocalDatabase();
  const cmd = process.argv[2];
  if (cmd !== "seed" && cmd !== "check") {
    throw new Error("Usage: overtime-scenarios.ts <seed|check>");
  }
  if (cmd === "seed") await seed();
  if (!(await check())) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

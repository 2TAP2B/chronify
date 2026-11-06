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
  VacationError,
} from "@/server/services/vacation";
import {
  ClosureError,
  createClosure,
  deleteClosure,
  updateChoice,
} from "@/server/services/business-closures";
import { createSickNote, deleteSickNote } from "@/server/services/sickness";
import { vacationAccount } from "@/server/services/leave-balance";
import { ensureHolidays } from "@/server/year-rollover";
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
  | { kind: "vacationHalfDay"; date: string; workMinutes: number }
  /** Sick note entered after the leave was approved; `deleteAfter`: removed again. */
  | { kind: "sick"; from: string; to: string; deleteAfter?: true };

type Scenario = {
  key: string;
  name: string;
  hireDate: string;
  models: ModelDef[];
  events: EventDef[];
  /** Employee switches the business-closure choice from vacation to overtime. */
  closureChoice: "VACATION" | "OVERTIME";
  /** 24.12/31.12 neither worked nor booked (default: the half is worked). */
  skipOrgHalfDays?: true;
  /** Contract vacation days set for the hire year (inherited by later years). */
  vacationDaysPerYear?: number;
  /** Hand-calculated from the rules (see comments). */
  expected: {
    consumedOvertimeMinutes: Partial<Record<number, number>>;
    vacationDays: Partial<Record<number, number>>;
    /** Unused vacation days carried into the year (live from the previous year). */
    vacationCarry?: Partial<Record<number, number>>;
    /** Contract days of the year (inherited from the latest earlier year). */
    vacationTotal?: Partial<Record<number, number>>;
    /** Overtime debited via the closure day (choice OVERTIME): that day's model minutes. */
    closureOvertimeMinutes: number;
    /** Not enough vacation left: the closure is booked as overtime automatically. */
    closureFallback?: true;
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
      { kind: "overtimeDay", date: "2025-12-24" }, // Wed, half working day → 240 min
      { kind: "vacation", from: "2025-12-31", to: "2025-12-31" }, // Wed, half day → 0.5 days
      { kind: "vacation", from: "2026-08-03", to: "2026-08-07" }, // Mon–Fri → 5 days
    ],
    closureChoice: "VACATION", // Fri 8h → 1 vacation day
    vacationDaysPerYear: 28, // contract set in 2025, inherited by 2026
    expected: {
      consumedOvertimeMinutes: { [PREV_YEAR]: 720, [YEAR]: 0 },
      vacationDays: { [PREV_YEAR]: 0.5, [YEAR]: 6 },
      // 28 − 0.5 unused days of 2025 carry over in full.
      vacationCarry: { [YEAR]: 27.5 },
      vacationTotal: { [PREV_YEAR]: 28, [YEAR]: 28 },
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
  {
    key: "halbtagschliesstag",
    name: "Szenario Halber Urlaubstag am späteren Schließtag",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 480, 480, 480] }],
    events: [
      // Half vacation day on Fri 15.05., booked before the closure exists: the
      // closure takes the whole day over (0.5 refunded, 1 day charged, nothing owed).
      { kind: "vacationHalfDay", date: "2026-05-15", workMinutes: 240 },
    ],
    closureChoice: "VACATION",
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 0 },
      vacationDays: { [YEAR]: 1 },
      closureOvertimeMinutes: 0,
    },
  },
  {
    key: "halbtage",
    name: "Szenario Halbe Tage ungebucht",
    hireDate: "2025-12-01",
    models: [{ from: "2025-12-01", week: [480, 480, 480, 480, 480] }],
    // 24.12/31.12.2025 neither worked nor booked → only the half is missing (-4h each).
    skipOrgHalfDays: true,
    events: [
      // Half vacation day, other half not worked → 0.5 days, half target owed (-4h).
      { kind: "vacationHalfDay", date: "2026-03-10", workMinutes: 0 },
    ],
    closureChoice: "VACATION",
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 0 },
      vacationDays: { [YEAR]: 1.5 },
      closureOvertimeMinutes: 0,
    },
  },
  {
    key: "wenigurlaub",
    name: "Szenario Schließtag ohne Resturlaub",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 480, 480, 480] }],
    vacationDaysPerYear: 2,
    events: [
      // Both vacation days used up → the closure (Fri 8h) is booked as overtime
      // automatically and the balance takes the 8h.
      { kind: "vacation", from: "2026-02-02", to: "2026-02-03" },
    ],
    closureChoice: "VACATION",
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 0 },
      vacationDays: { [YEAR]: 2 },
      closureOvertimeMinutes: 480,
      closureFallback: true,
    },
  },
  {
    key: "krankimurlaub",
    name: "Szenario Krank im Urlaub",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 480, 480, 480] }],
    events: [
      // 5 vacation days, sick Wed+Thu → 2 days given back (BUrlG §9): 3 + closure 1.
      { kind: "vacation", from: "2026-08-03", to: "2026-08-07" },
      { kind: "sick", from: "2026-08-05", to: "2026-08-06" },
      // Day off from overtime, sick that day → the 8h are refunded.
      { kind: "overtimeDay", date: "2026-06-11" },
      { kind: "sick", from: "2026-06-11", to: "2026-06-11" },
    ],
    closureChoice: "VACATION",
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 0 },
      vacationDays: { [YEAR]: 4 },
      closureOvertimeMinutes: 0,
    },
  },
  {
    key: "krankgeloescht",
    name: "Szenario Krankmeldung im Urlaub gelöscht",
    hireDate: "2026-01-01",
    models: [{ from: "2026-01-01", week: [480, 480, 480, 480, 480] }],
    events: [
      // Sick note entered and deleted again → vacation booked again: 5 + closure 1.
      { kind: "vacation", from: "2026-08-03", to: "2026-08-07" },
      { kind: "sick", from: "2026-08-05", to: "2026-08-06", deleteAfter: true },
    ],
    closureChoice: "VACATION",
    expected: {
      consumedOvertimeMinutes: { [YEAR]: 0 },
      vacationDays: { [YEAR]: 6 },
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
    if (e.kind === "sick") {
      for (let x = d(e.from); x <= d(e.to); x = addDaysUtc(x, 1)) off.add(iso(x));
    }
  }

  const plan: PlannedDay[] = [];
  const extrasByMonth = new Map<string, number>();
  for (let x = d(s.hireDate); x < d(`${YEAR + 1}-01-01`); x = addDaysUtc(x, 1)) {
    const key = iso(x);
    const target = targetOn(s, x);
    if (target === 0 || cal.holidays.has(key)) continue;
    if (off.has(key)) continue;
    const halfTarget = Math.floor(target / 2);
    if (cal.halfDays.has(key.slice(5))) {
      // 24.12/31.12: half working day for the org. Worked half → 0; neither
      // worked nor booked → the half is missing.
      plan.push(
        s.skipOrgHalfDays
          ? { date: x, workMinutes: 0, deltaMinutes: -halfTarget }
          : { date: x, workMinutes: halfTarget, deltaMinutes: 0 }
      );
      continue;
    }
    if (key === CLOSURE_DAY) {
      // Closure day: no work. With OVERTIME the missing target is the debit.
      plan.push({ date: x, workMinutes: 0, deltaMinutes: -s.expected.closureOvertimeMinutes });
      continue;
    }
    const halfWork = half.get(key);
    if (halfWork !== undefined) {
      // One half is vacation/overtime; the other half is owed as work.
      plan.push({ date: x, workMinutes: halfWork, deltaMinutes: halfWork - halfTarget });
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

  // Cleanup: the scenario closure lies in the past (deleteClosure refuses
  // started closures), so reverse it directly for every user, then drop the
  // test users.
  for (const c of await db.businessClosure.findMany({ where: { name: CLOSURE_NAME } })) {
    const entries = await db.timeEntry.findMany({
      where: { type: "VACATION", note: `Schließtag: ${c.name}`, date: { gte: c.from, lte: c.to } },
      select: { id: true, userId: true },
    });
    const perUser = new Map<string, number>();
    for (const e of entries) perUser.set(e.userId, (perUser.get(e.userId) ?? 0) + 1);
    for (const [userId, n] of perUser) {
      await db.vacationEntitlement
        .update({
          where: { userId_year: { userId, year: c.from.getUTCFullYear() } },
          data: { consumedDays: { decrement: n } },
        })
        .catch(() => {});
    }
    await db.timeEntry.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
    await db.businessClosure.delete({ where: { id: c.id } });
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
    if (s.vacationDaysPerYear !== undefined) {
      await db.vacationEntitlement.create({
        data: {
          userId: user.id,
          year: Number(s.hireDate.slice(0, 4)),
          totalDays: s.vacationDaysPerYear,
        },
      });
    }

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
  type LeaveEvent = Exclude<EventDef, { kind: "sick" }>;
  const isLeave = (e: EventDef): e is LeaveEvent => e.kind !== "sick";
  const request = async (userId: string, e: LeaveEvent) => {
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

  // Previous-year events; the year change itself needs no step (live carryover).
  for (const s of SCENARIOS) {
    for (const e of s.events.filter(isLeave).filter((x) => eventYear(x) === PREV_YEAR)) {
      await request(users.get(s.key)!, e);
    }
  }
  const afterClosure = (e: EventDef) => e.kind === "vacation" && e.createAfterClosure === true;
  for (const s of SCENARIOS) {
    const events = s.events.filter(isLeave);
    for (const e of events.filter((x) => eventYear(x) === YEAR && !afterClosure(x))) {
      await request(users.get(s.key)!, e);
    }
  }

  const closure = await createClosure({
    actor,
    input: { from: d(CLOSURE_DAY), to: d(CLOSURE_DAY), name: CLOSURE_NAME },
  });
  for (const s of SCENARIOS) {
    for (const e of s.events.filter(isLeave).filter(afterClosure)) {
      await request(users.get(s.key)!, e);
    }
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
  // Sick notes after the leave they overlap (sickness during vacation).
  for (const s of SCENARIOS) {
    for (const e of s.events) {
      if (e.kind !== "sick") continue;
      const note = await createSickNote({
        actor,
        targetUserId: users.get(s.key)!,
        input: { from: d(e.from), to: d(e.to), aubUntil: d(e.to), note: "Szenario" },
      });
      if (e.deleteAfter) await deleteSickNote({ actor, noteId: note.id });
    }
  }
  console.log(`✓ Schließtag ${CLOSURE_DAY} + Anträge genehmigt/storniert + Krankmeldungen`);
  console.log(`\nLogin: <key>@${EMAIL_DOMAIN} / ${PASSWORD}`);
}

function eventYear(e: EventDef): number {
  return Number((e.kind === "vacation" || e.kind === "sick" ? e.from : e.date).slice(0, 4));
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
      const expectedCarry = s.expected.vacationCarry?.[year];
      const expectedTotal = s.expected.vacationTotal?.[year];
      if (expectedCarry !== undefined || expectedTotal !== undefined) {
        const account = await vacationAccount(user.id, year);
        if (expectedCarry !== undefined) {
          add(
            `${year} Resturlaub übertragen`,
            String(expectedCarry),
            String(account.carriedOverDays)
          );
        }
        if (expectedTotal !== undefined) {
          add(`${year} Urlaubsanspruch`, String(expectedTotal), String(account.baseTotalDays));
        }
      }
      carry = balance;
    }

    const closureChoice = await db.closureChoice.findFirst({
      where: { userId: user.id, closure: { name: CLOSURE_NAME } },
    });
    add(
      "Schließtag verrechnet als",
      s.expected.closureFallback || s.closureChoice === "OVERTIME" ? "OVERTIME" : "VACATION",
      closureChoice?.choice ?? "-"
    );

    for (const [label, expected, actual] of rows) {
      const pass = expected === actual;
      if (!pass && expected !== "") ok = false;
      const mark = expected === "" ? "" : pass ? "OK  " : "FAIL";
      console.log(
        `  ${mark.padEnd(4)} ${label.padEnd(28)} soll ${expected.padStart(8)}  ist ${actual.padStart(8)}`
      );
    }
  }
  const lateOk = await checkLateCorrection();
  const holidaysOk = await checkHolidayAutomation();
  const closureDeleteOk = await checkStartedClosureDelete();
  const guardsOk = await checkGuards();
  ok = ok && lateOk && holidaysOk && closureDeleteOk && guardsOk;
  console.log(ok ? "\nAlle Szenarien OK." : "\nAbweichungen gefunden (FAIL).");
  return ok;
}

/** A closure that already started can't be deleted (its days were actually off). */
async function checkStartedClosureDelete(): Promise<boolean> {
  const actor = await adminActor();
  const closure = await db.businessClosure.findFirstOrThrow({ where: { name: CLOSURE_NAME } });
  let code: string | null = null;
  try {
    await deleteClosure({ actor, closureId: closure.id });
  } catch (e) {
    code = e instanceof ClosureError ? e.code : String(e);
  }
  const pass = code === "CLOSURE_STARTED";
  console.log(
    `  ${(pass ? "OK" : "FAIL").padEnd(4)} ${"Begonnenen Schließtag löschen".padEnd(44)} soll CLOSURE_STARTED          ist ${code ?? "gelöscht"}`
  );
  return pass;
}

/**
 * Next year's holidays appear automatically from December on (not before),
 * so the year starts with holidays already excused.
 */
async function checkHolidayAutomation(): Promise<boolean> {
  const next = YEAR + 1;
  const where = {
    federalState: STATE,
    date: { gte: d(`${next}-01-01`), lt: d(`${next + 1}-01-01`) },
  };
  await db.publicHoliday.deleteMany({ where });
  await ensureHolidays(d(`${YEAR}-11-15`));
  const inNovember = await db.publicHoliday.count({ where });
  await ensureHolidays(d(`${YEAR}-12-01`));
  const inDecember = await db.publicHoliday.count({ where });
  const pass = inNovember === 0 && inDecember > 0;
  console.log(
    `  ${(pass ? "OK" : "FAIL").padEnd(4)} ${`Feiertage ${next} automatisch (Nov/Dez)`.padEnd(44)} soll 0 / >0                  ist ${inNovember} / ${inDecember}`
  );
  return pass;
}

/**
 * A correction to last December after the year change flows into the new
 * year's carryover (nothing is frozen): +1h on 29.12.2025 → +1h carried into
 * 2026. The extra entry is removed again.
 */
async function checkLateCorrection(): Promise<boolean> {
  const user = await db.user.findUniqueOrThrow({ where: { email: `vollzeit@${EMAIL_DOMAIN}` } });
  const carryOf = async () =>
    (await computeYearOvertime({ userId: user.id, year: YEAR, timeZone: TZ })).carriedOverMinutes;
  const before = await carryOf();
  const startAt = zonedTimeToUtc(PREV_YEAR, 12, 29, 18, 0, TZ);
  const extra = await db.timeEntry.create({
    data: {
      userId: user.id,
      date: d(`${PREV_YEAR}-12-29`),
      startAt,
      endAt: new Date(startAt.getTime() + 60 * 60_000),
      type: "WORK",
      source: "MANUAL",
      note: "Szenario-Korrektur",
    },
  });
  let after: number;
  try {
    after = await carryOf();
  } finally {
    await db.timeEntry.delete({ where: { id: extra.id } });
  }
  const pass = after - before === 60;
  console.log(`\nJahreswechsel (${user.email})`);
  console.log(
    `  ${(pass ? "OK" : "FAIL").padEnd(4)} ${"Dezember-Korrektur +1h nach Jahreswechsel".padEnd(44)} soll Übertrag +1:00          ist ${fmt(after - before)}`
  );
  return pass;
}

/**
 * Vacation days may not go negative (overtime may). Uses the 4-day-week user
 * (32h, 26 vacation days left); every request created here is deleted again,
 * the entitlement is restored.
 */
async function checkGuards(): Promise<boolean> {
  const actor = await adminActor();
  const user = await db.user.findUniqueOrThrow({ where: { email: `viertage@${EMAIL_DOMAIN}` } });
  const created: string[] = [];
  const entitlementKey = { userId_year: { userId: user.id, year: YEAR } };
  const before = await db.vacationEntitlement.findUniqueOrThrow({ where: entitlementKey });
  let ok = true;
  console.log(`\nSperren gegen Minus (${user.email})`);

  const expectCode = async (
    label: string,
    expected: string | null,
    run: () => Promise<unknown>
  ) => {
    let actual: string | null = null;
    try {
      await run();
    } catch (e) {
      actual = e instanceof VacationError ? e.code : String(e);
    }
    const pass = actual === expected;
    if (!pass) ok = false;
    console.log(
      `  ${(pass ? "OK" : "FAIL").padEnd(4)} ${label.padEnd(44)} soll ${String(expected ?? "erlaubt").padEnd(24)} ist ${actual ?? "erlaubt"}`
    );
  };
  const request = async (from: string, to: string, useOvertime = false) => {
    const r = await createVacationRequest({
      actor,
      input: {
        from: d(from),
        to: d(to),
        useOvertime,
        targetUserId: user.id,
        note: "Szenario-Sperre",
      },
    });
    created.push(r.id);
    return r;
  };

  try {
    // 11 Mon–Thu days × 8h = 88h > ~46h balance: overtime may go negative.
    await expectCode("Überstunden-Antrag ins Minus", null, () =>
      request("2026-12-01", "2026-12-17", true)
    );
    await db.vacationRequest.deleteMany({ where: { id: { in: created.splice(0) } } });
    // 2026-09-01..2026-12-23: far more than 26 working days.
    await expectCode("Urlaubsantrag über Anspruch", "INSUFFICIENT_ENTITLEMENT", () =>
      request("2026-09-01", "2026-12-23")
    );
    // A: 16 days pending (fits 26); B: 14.5 days fits alone, but not on top of A.
    let pendingA: { id: string } | undefined;
    await expectCode("Antrag A (16 Tage) offen", null, async () => {
      pendingA = await request("2026-11-09", "2026-12-04");
    });
    await expectCode("Antrag B (14,5 Tage) trotz offenem A", "INSUFFICIENT_ENTITLEMENT", () =>
      request("2026-12-07", "2026-12-30")
    );
    // Balance shrinks after A was requested → approval re-check refuses A.
    if (pendingA) {
      const requestId = pendingA.id;
      await db.vacationEntitlement.update({
        where: entitlementKey,
        data: { consumedDays: { increment: 15 } },
      });
      await expectCode("Genehmigung A nach Verbrauch", "INSUFFICIENT_ENTITLEMENT", () =>
        approveVacationRequest({ actor, requestId })
      );
    }
  } finally {
    await db.vacationRequest.deleteMany({ where: { id: { in: created } } });
    await db.vacationEntitlement.update({
      where: entitlementKey,
      data: { consumedDays: before.consumedDays },
    });
  }
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

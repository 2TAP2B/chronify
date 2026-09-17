import { describe, it, expect } from "vitest";
import { notificationText, arbzgWarningText } from "./server-texts";

describe("notificationText (vacation)", () => {
  it("renders approved in German and English", () => {
    expect(
      notificationText("vacationApproved", "de", { fromDate: "2026-09-14", toDate: "2026-09-18" })
    ).toEqual({
      title: "Urlaub genehmigt",
      body: "Urlaub 2026-09-14 – 2026-09-18 wurde genehmigt.",
    });
    expect(
      notificationText("vacationApproved", "en", { fromDate: "2026-09-14", toDate: "2026-09-18" })
    ).toEqual({
      title: "Vacation approved",
      body: "Vacation 2026-09-14 – 2026-09-18 has been approved.",
    });
  });

  it("renders rejected and requested", () => {
    const rejected = notificationText("vacationRejected", "de", { fromDate: "a", toDate: "b" });
    expect(rejected.title).toBe("Urlaub abgelehnt");
    const requested = notificationText("vacationRequested", "en", {
      actorName: "Finn",
      days: 5,
      fromDate: "a",
      toDate: "b",
    });
    expect(requested.title).toBe("New vacation request");
    expect(requested.body).toBe("Finn requested 5 day(s) of vacation (a – b)");
    const requestedDe = notificationText("vacationRequested", "de", {
      actorName: "Finn",
      days: 5,
      fromDate: "a",
      toDate: "b",
    });
    expect(requestedDe.body).toBe("Finn beantragt 5 Tag(e) Urlaub (a – b)");
  });

  it("renders closure choice", () => {
    const de = notificationText("closureChoice", "de", { closureName: "Betriebsausflug", days: 1 });
    expect(de.title).toBe("Schließtag");
    const en = notificationText("closureChoice", "en", { closureName: "Company trip", days: 1 });
    expect(en.title).toBe("Business closure");
  });
});

describe("arbzgWarningText", () => {
  it("localizes all three warnings", () => {
    for (const key of ["approachingMax", "exceededMax", "restPeriodShort"]) {
      expect(arbzgWarningText(key, "de")?.title).toContain("ArbZG");
      expect(arbzgWarningText(key, "en")?.body).toContain("ArbZG");
    }
  });

  it("returns null for unknown keys", () => {
    expect(arbzgWarningText("bogus", "de")).toBeNull();
  });
});

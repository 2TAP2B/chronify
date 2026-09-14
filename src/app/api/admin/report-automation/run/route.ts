import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { runReportAutomation } from "@/server/services/report-automation";

export async function POST() {
  try {
    const user = await requireUser();
    const result = await runReportAutomation({ actor: user, kind: "MANUAL" });
    if (result.status === "ERROR") {
      return NextResponse.json(
        { error: result.error ?? "Automation run failed", result },
        { status: result.generated === 0 && result.failed === 0 ? 500 : 200 }
      );
    }
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

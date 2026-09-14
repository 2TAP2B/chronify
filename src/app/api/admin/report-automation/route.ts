import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  getReportAutomation,
  updateReportAutomation,
  updateReportAutomationSchema,
} from "@/server/services/report-automation";

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await getReportAutomation(user);
    return NextResponse.json({ settings });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    const input = updateReportAutomationSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: input.error.issues },
        { status: 400 }
      );
    }
    const settings = await updateReportAutomation({ actor: user, input: input.data });
    return NextResponse.json({ settings });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

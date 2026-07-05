import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import {
  approveVacationRequest,
  rejectVacationRequest,
  cancelVacationRequest,
  VacationError,
} from "@/server/services/vacation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const user = await requireUser();
    const { id, action } = await params;
    const body = await request.json().catch(() => ({}));
    const approverNote = body?.approverNote ?? null;

    if (action === "approve") {
      const r = await approveVacationRequest({
        actor: user,
        requestId: id,
        approverNote,
      });
      return NextResponse.json({ request: r });
    }
    if (action === "reject") {
      const r = await rejectVacationRequest({
        actor: user,
        requestId: id,
        approverNote,
      });
      return NextResponse.json({ request: r });
    }
    if (action === "cancel") {
      const r = await cancelVacationRequest({ actor: user, requestId: id });
      return NextResponse.json({ request: r });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof VacationError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

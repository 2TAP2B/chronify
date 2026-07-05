import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { startBreak, endBreak, TimerError } from "@/server/services/timer";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "start" && action !== "end") {
      return NextResponse.json(
        { error: "action must be 'start' or 'end'", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }
    const session = action === "start" ? await startBreak(user.id) : await endBreak(user.id);
    return NextResponse.json({
      onBreak: session.breakStartedAt != null,
      breakStartedAt: session.breakStartedAt?.toISOString() ?? null,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof TimerError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

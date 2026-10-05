import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { remoteStopTimer, stopTimer, TimerError } from "@/server/services/timer";

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    const body = await request.json().catch(() => null);
    const targetUserId =
      body && typeof body === "object" && "userId" in body
        ? (body as { userId?: unknown }).userId
        : undefined;
    const userId = typeof targetUserId === "string" ? targetUserId : actor.id;

    if (userId !== actor.id && actor.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    const result =
      userId === actor.id ? await stopTimer(userId) : await remoteStopTimer({ actor, userId });
    return NextResponse.json({
      active: false,
      workedMinutes: result.workedMinutes,
      breakMinutes: result.breakMinutes,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof TimerError) {
      const status = e.code === "FORBIDDEN" ? 403 : 409;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

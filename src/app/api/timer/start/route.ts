import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { startTimer, TimerError } from "@/server/services/timer";

export async function POST() {
  try {
    const user = await requireUser();
    const session = await startTimer(user.id);
    return NextResponse.json({ active: true, startedAt: session.startedAt.toISOString() });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof TimerError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
